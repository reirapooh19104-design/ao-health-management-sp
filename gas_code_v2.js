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

const SHEET_NAME = 'data';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
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
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: 'unauthorized' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 全データ取得（GET リクエスト）
function doGet(e) {
  // ── 認証チェック（追加） ──
  const token = e.parameter && e.parameter.token;
  if (!isAuthorized(token)) return unauthorizedResponse();
  // ── ここから既存ロジック（変更なし） ──

  const sheet = getOrCreateSheet();
  const result = {};
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    const rows = sheet.getRange(1, 1, lastRow, 2).getValues();
    rows.forEach(([key, value]) => {
      if (key) {
        try { result[key] = JSON.parse(value); } catch { result[key] = value; }
      }
    });
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// データ保存（POST リクエスト）← 一括受信に対応
function doPost(e) {
  const body = JSON.parse(e.postData.contents);

  // ── 認証チェック（追加） ──
  if (!isAuthorized(body.token)) return unauthorizedResponse();
  // ── ここから既存ロジック（変更なし） ──

  const sheet = getOrCreateSheet();

  // 一括送信（bulk）の場合
  if (body.bulk && body.data) {
    const lastRow = sheet.getLastRow();
    const dataMap = {};

    // 既存データをメモリに読み込む
    if (lastRow > 0) {
      const existing = sheet.getRange(1, 1, lastRow, 2).getValues();
      existing.forEach(([k, v]) => { if (k) dataMap[k] = v; });
    }

    // 新データで上書き
    Object.entries(body.data).forEach(([k, v]) => {
      dataMap[k] = JSON.stringify(v);
    });

    // 全データを一括書き込み
    const rows = Object.entries(dataMap);
    if (rows.length > 0) {
      // 既存行をクリアして書き直し
      if (lastRow > 0) sheet.getRange(1, 1, lastRow, 2).clearContent();
      sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', count: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 従来の1件ずつ送信（後方互換）
  const { key, value } = body;
  const lastRow = sheet.getLastRow();
  const serialized = JSON.stringify(value);

  if (lastRow === 0) {
    sheet.appendRow([key, serialized]);
  } else {
    const range = sheet.getRange(1, 1, lastRow, 2);
    const allData = range.getValues();
    let foundIndex = -1;
    for (let i = 0; i < allData.length; i++) {
      if (allData[i][0] === key) { foundIndex = i; break; }
    }
    if (foundIndex >= 0) {
      allData[foundIndex][1] = serialized;
      range.setValues(allData);
    } else {
      sheet.appendRow([key, serialized]);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
