// ============================================================
// Google Apps Script コード（v2：合言葉認証つき）
// ============================================================
// 【セットアップ必須】このコードを貼り付けた後、必ず以下を行うこと：
//   1. Apps Scriptエディタ左メニュー「プロジェクトの設定」→
//      「スクリプト プロパティ」→「スクリプト プロパティを追加」
//   2. プロパティ名: SYNC_TOKEN
//      値: 好きな合言葉（第三者に推測されにくい文字列を推奨）
//   3. 保存後、Webアプリとして再デプロイ（新バージョンとして）
//
// ※ SYNC_TOKEN を設定しない限り、全ての同期リクエストが
//    unauthorized で拒否される（安全側に倒す設計。
//    「未設定＝誰でも通す」には絶対にしない）。
// ※ 合言葉そのものはこのファイルのどこにも書かない
//    （スクリプトプロパティ側にのみ保存する）。
// ============================================================
//
// 【版の目印】v9（2026-11）：POSTでの全データ受信（action:'getAll'）／合言葉の間違いを auth_log タブに記録
//
// 【シートの保存形式（2026-11 デプロイ v8〜）】
//   A列＝キー、B列以降＝値（JSON文字列）。
//   値が長いときは CHUNK_SIZE 文字ごとに分けて B, C, D… に並べる
//   （Googleスプレッドシートは1セル50,000文字が上限のため）。
//   読むときは B列から右へ、空セルの手前までを連結する。
//   旧形式（B列1セルだけ）はそのまま読める（移行作業は不要）。
//   ★ 分割された行は旧コード（v7以前）では正しく読めない。
//     旧バージョンへ戻すときは CLAUDE.md の手順を参照。
// ============================================================

const SHEET_NAME = 'data';
const LOCK_WAIT_MS = 30000; // ロック待機の上限（ミリ秒）
const CHUNK_SIZE = 45000;   // 1セルに入れる最大文字数（上限50,000に対する余裕込み）
const CELL_LIMIT = 50000;   // スプレッドシートの1セル上限
const AUTH_LOG_SHEET = 'auth_log';  // 合言葉の間違いを記録するタブ（v9〜）
const AUTH_LOG_MAX_ROWS = 2000;     // 記録の上限行数（超えたら古い方から消す）

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 認証ヘルパー ──────────────────────────────────────────
// SYNC_TOKEN未設定時・token不一致時は false（＝拒否）を返す。
function isAuthorized(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!expected) return false; // 未設定は必ず拒否
  if (typeof token !== 'string' || !token) return false;
  // 長さと内容の両方を比較する
  return token.length === expected.length && token === expected;
}

function unauthorizedResponse() {
  return jsonResponse({ status: 'error', message: 'unauthorized' });
}

// ── 合言葉の間違いの記録（v9〜） ─────────────────────────
// 通信は止めず、「いつ・何回」間違いがあったかを auth_log タブに残すだけ。
// 1時間ごとに1行（時間帯／回数／最後の時刻／受信の回数／保存の回数）。
// 送られてきた合言葉そのものは記録しない（本物に近い打ち間違いが残るのを避ける）。
// 記録に失敗しても応答には影響させない（全体を try/catch で囲む）。
function logAuthFailure_(kind) {
  try {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) return; // 混んでいたら記録をあきらめる
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(AUTH_LOG_SHEET);
      if (!sheet) {
        sheet = ss.insertSheet(AUTH_LOG_SHEET);
        sheet.getRange(1, 1, 1, 5).setNumberFormat('@')
          .setValues([['時間帯', '間違いの回数', '最後の時刻', 'うち受信', 'うち保存']]);
      }
      const now = new Date();
      const hour = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH') + '時台';
      const stamp = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      const lastRow = sheet.getLastRow();
      let row = null;
      if (lastRow >= 2) {
        const cur = sheet.getRange(lastRow, 1, 1, 5).getValues()[0];
        if (String(cur[0]) === hour) row = cur;
      }
      if (row) {
        const total = (Number(row[1]) || 0) + 1;
        const gets = (Number(row[3]) || 0) + (kind === 'get' ? 1 : 0);
        const posts = (Number(row[4]) || 0) + (kind === 'post' ? 1 : 0);
        sheet.getRange(lastRow, 1, 1, 5).setNumberFormat('@')
          .setValues([[hour, String(total), stamp, String(gets), String(posts)]]);
      } else {
        const next = lastRow + 1;
        if (sheet.getMaxRows() < next) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
        sheet.getRange(next, 1, 1, 5).setNumberFormat('@')
          .setValues([[hour, '1', stamp, kind === 'get' ? '1' : '0', kind === 'post' ? '1' : '0']]);
        if (next > AUTH_LOG_MAX_ROWS) sheet.deleteRows(2, 500);
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error('logAuthFailure_ failed: ' + err);
  }
}

// ── ロックヘルパー ────────────────────────────────────────
// ロック無しだと「全シート読み→全シート書き戻し」同士が並行実行され、
// 後着が前着の変更を消す（半書き込みレース。2026-07-05 原因確定）。
// ScriptLock でシートの読み書きを直列化する。
// ロック取得は認証チェックの後に行う（不正リクエストに待たせない）。
function busyResponse() {
  return jsonResponse({ status: 'error', message: 'busy' });
}

// ── 値の分割（1セル50,000文字上限への対応） ────────────────
// 分割位置として避ける場所：
//  ・サロゲートペア（絵文字など）の途中
//  ・前後が空白文字になる位置（セルの前後空白が落ちる事故の予防）
//  ・次の断片が = + - ' @ で始まる位置（数式・特殊入力と解釈される事故の予防）
function isBadSplit_(s, end) {
  const prevCode = s.charCodeAt(end - 1);
  if (prevCode >= 0xD800 && prevCode <= 0xDBFF) return true;
  const prev = s.charAt(end - 1);
  const next = s.charAt(end);
  if (/\s/.test(prev) || /\s/.test(next)) return true;
  if ('=+-\'@'.indexOf(next) >= 0) return true;
  return false;
}

function splitValue_(s) {
  if (s.length <= CHUNK_SIZE) return [s];
  const chunks = [];
  let pos = 0;
  while (pos < s.length) {
    let end = Math.min(pos + CHUNK_SIZE, s.length);
    if (end < s.length) {
      let back = 0;
      while (back < 500 && end > pos + 1 && isBadSplit_(s, end)) { end--; back++; }
    }
    chunks.push(s.slice(pos, end));
    pos = end;
  }
  return chunks;
}

// 保存値（文字列・数値・真偽値など）を「セルの並び」に変換する。
// 数値・真偽値は文字列化して書く（値の列は書式なしテキストにするため、
// 大きな数値が指数表記に化けるのを防ぐ）。
function toCells_(value) {
  if (typeof value === 'string') return splitValue_(value);
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  return [value]; // 想定外の型（日付など）はそのまま書き戻す
}

// ── シート全体の読み込み ──────────────────────────────────
// 戻り値: { order: [キー…（行の並び順）], values: {キー: 値}, lastRow, width }
// 値は「1セルだけの行＝セルの生の値（旧形式互換）」「複数セルの行＝連結した文字列」。
function readStore_(sheet) {
  const lastRow = sheet.getLastRow();
  const width = Math.max(sheet.getLastColumn(), 2);
  const store = { order: [], values: {}, lastRow: lastRow, width: width };
  if (lastRow === 0) return store;
  const rows = sheet.getRange(1, 1, lastRow, width).getValues();
  rows.forEach(function(row) {
    const key = row[0];
    if (key === '' || key === null || key === undefined) return;
    const k = String(key);
    let value;
    if (row.length <= 2 || row[2] === '') {
      value = row[1]; // 旧形式・短い値：B列をそのまま使う
    } else {
      value = '';
      for (let i = 1; i < row.length; i++) {
        if (row[i] === '') break;
        value += String(row[i]);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(store.values, k)) store.order.push(k);
    store.values[k] = value; // 同じキーが重複していたら後の行を採用（従来どおり）
  });
  return store;
}

// ── シート全体の書き込み ──────────────────────────────────
// 「消してから書く」はしない。全体を1回の setValues で上書きするので、
// 途中で失敗してもシートは元のまま残る。余った行は書き込み成功後にだけ消す。
function writeStore_(sheet, store) {
  const rowsCells = store.order.map(function(k) { return [k].concat(toCells_(store.values[k])); });
  if (rowsCells.length === 0) return;
  let width = store.width;
  rowsCells.forEach(function(r) { if (r.length > width) width = r.length; });
  // 書き込み前の検査：1セル上限を超えるものがあれば何も書かずに失敗させる
  rowsCells.forEach(function(r) {
    for (let i = 1; i < r.length; i++) {
      if (typeof r[i] === 'string' && r[i].length > CELL_LIMIT) {
        throw new Error('cell too long: key=' + r[0]);
      }
    }
  });
  // 幅をそろえる（余りは空文字。前回より断片が減った行の古いセルもこれで消える）
  const matrix = rowsCells.map(function(r) {
    const out = r.slice();
    while (out.length < width) out.push('');
    return out;
  });
  // シートの大きさが足りなければ広げる
  const maxRows = sheet.getMaxRows();
  if (maxRows < matrix.length) sheet.insertRowsAfter(maxRows, matrix.length - maxRows);
  const maxCols = sheet.getMaxColumns();
  if (maxCols < width) sheet.insertColumnsAfter(maxCols, width - maxCols);
  // 値の列を書式なしテキストにしてから一括書き込み
  sheet.getRange(1, 2, matrix.length, width - 1).setNumberFormat('@');
  sheet.getRange(1, 1, matrix.length, width).setValues(matrix);
  // 余った行（重複キーの整理などで行数が減った場合）を、成功後に消す
  if (store.lastRow > matrix.length) {
    sheet.getRange(matrix.length + 1, 1, store.lastRow - matrix.length, width).clearContent();
  }
}

// ── deleted_ids（削除記録）の合算 ──────────────────────────
// 端末が送ってきた削除記録で上書きすると、他端末の削除記録が消えて
// 削除済み項目が復活する。保存済みと種類ごとに合わせて保存する（減らない）。
function mergeDeletedIds_(storedRaw, incoming) {
  let stored = {};
  try {
    const p = (typeof storedRaw === 'string') ? JSON.parse(storedRaw) : storedRaw;
    if (p && typeof p === 'object' && !Array.isArray(p)) stored = p;
  } catch (err) { stored = {}; }
  const out = {};
  Object.keys(stored).forEach(function(cat) {
    out[cat] = Array.isArray(stored[cat]) ? stored[cat].map(String) : [];
  });
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    Object.keys(incoming).forEach(function(cat) {
      if (!Array.isArray(incoming[cat])) return;
      if (!out[cat]) out[cat] = [];
      const seen = {};
      out[cat].forEach(function(id) { seen[id] = true; });
      incoming[cat].forEach(function(id) {
        const s = String(id);
        if (!seen[s]) { seen[s] = true; out[cat].push(s); }
      });
    });
  }
  return out;
}

function serialize_(v) {
  const s = JSON.stringify(v);
  return s === undefined ? 'null' : s;
}

// 全データ取得（GET リクエスト）
function doGet(e) {
  // ── 認証チェック ──
  // ※ URLに合言葉を付ける受信は旧アプリ用の互換経路（v9〜のアプリは doPost の action:'getAll' を使う）。
  //    全端末が新しいアプリになったら、ここで受け付けをやめる予定。
  const token = e.parameter && e.parameter.token;
  if (!isAuthorized(token)) { logAuthFailure_('get'); return unauthorizedResponse(); }
  return readAllResponse_();
}

// 全データを読んで返す（doGet と、doPost の action:'getAll' の共通処理）
function readAllResponse_() {
  // ── ロック取得（書き込みの途中を読まないため） ──
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (err) {
    return busyResponse();
  }
  try {
    // ※ ここで起きた内部エラーは catch せずそのまま失敗させる（従来どおり）。
    //    新しい形のエラー応答を返すと、古いアプリがそれをデータとして保存して
    //    しまうため（CLAUDE.md 落とし穴12）。アプリ側は「オフライン」表示になる。
    const sheet = getOrCreateSheet();
    const store = readStore_(sheet);
    const result = {};
    store.order.forEach(function(key) {
      const value = store.values[key];
      try { result[key] = JSON.parse(value); } catch (err) { result[key] = value; }
    });
    return jsonResponse(result);
  } finally {
    lock.releaseLock();
  }
}

// データ保存・全データ受信（POST リクエスト）
//   受信: { action:'getAll', token }  … doGet と同じ内容を返す（v9〜）
//   一括: { bulk:true, data:{キー:値,…}, token, force? }
//   1件 : { key, value, token }
//   オプション:
//     force:true              … 時刻の新旧チェックをせず必ず書く（「全データGAS同期」用）
//     replaceDeletedIds:true  … deleted_ids を合算せず置き換える（誤混入の掃除用・手動のみ）
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'bad_request' });
  }
  if (!body || typeof body !== 'object') {
    return jsonResponse({ status: 'error', message: 'bad_request' });
  }

  // ── 認証チェック ──
  if (!isAuthorized(body.token)) { logAuthFailure_('post'); return unauthorizedResponse(); }

  // 全データの受信（v9〜）：合言葉をURLに付けずに済むよう、POSTでも読めるようにしている
  if (body.action === 'getAll') return readAllResponse_();

  // 受け取ったデータを { キー: 値 } の形にそろえる
  let incoming;
  if (body.bulk && body.data) {
    if (typeof body.data !== 'object' || Array.isArray(body.data)) {
      return jsonResponse({ status: 'error', message: 'bad_request' });
    }
    incoming = body.data;
  } else {
    if (typeof body.key !== 'string' || body.key === '') {
      return jsonResponse({ status: 'error', message: 'bad_request' });
    }
    incoming = {};
    incoming[body.key] = body.value;
  }
  const force = body.force === true;
  const replaceDeletedIds = body.replaceDeletedIds === true;

  // ── ロック取得（読み→書きを直列化） ──
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (err) {
    return busyResponse();
  }
  try {
    const sheet = getOrCreateSheet();
    const store = readStore_(sheet);
    const has = function(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); };
    const put = function(k, serialized) {
      if (!has(store.values, k)) store.order.push(k);
      store.values[k] = serialized;
    };
    const skipped = [];
    let written = 0;

    Object.keys(incoming).forEach(function(k) {
      if (k === '') return;
      const isTsKey = k.indexOf('_ts_') === 0;
      if (isTsKey && has(incoming, k.slice(4))) return; // 本体キーと一緒に処理する

      if (k === 'deleted_ids' && !replaceDeletedIds) {
        // 削除記録は常に合算（時刻の新旧チェック対象外）
        put(k, serialize_(mergeDeletedIds_(store.values[k], incoming[k])));
        written++;
        if (has(incoming, '_ts_' + k)) { put('_ts_' + k, serialize_(incoming['_ts_' + k])); written++; }
        return;
      }

      const tsKey = '_ts_' + k;
      const hasTs = !isTsKey && has(incoming, tsKey);
      if (hasTs && !force) {
        // 本体と時刻がセットで届いたときだけ新旧を比べる。
        // 保存済みの時刻のほうが新しければ、この組は書き込まない
        // （送信の到着順が入れ替わったときに古い内容で上書きしないため）。
        const inTs = Number(incoming[tsKey]);
        const stTs = has(store.values, tsKey) ? Number(store.values[tsKey]) : NaN;
        if (isFinite(inTs) && isFinite(stTs) && stTs > inTs) {
          skipped.push(k);
          return;
        }
      }
      put(k, serialize_(incoming[k]));
      written++;
      if (hasTs) { put(tsKey, serialize_(incoming[tsKey])); written++; }
    });

    if (written > 0) writeStore_(sheet, store);

    const res = { status: 'ok', count: written };
    if (skipped.length > 0) res.skipped = skipped;
    return jsonResponse(res);
  } catch (err) {
    // 書き込みは1回の setValues にまとめているため、ここに来た場合シートは元のまま。
    console.error('doPost failed: ' + (err && err.stack ? err.stack : err));
    return jsonResponse({ status: 'error', message: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}
