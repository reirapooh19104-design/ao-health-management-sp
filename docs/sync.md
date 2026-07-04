# 同期の仕様と罠（最重要）

GAS同期の特性と事故防止の鉄則。**同期をいじる前に必ず読む。**

- データの保存先・形式・同期方式の一覧は [data-model.md](data-model.md) を参照。
- 同期に関わる関数（`pushToCloud` / `syncFromCloud` / `pushAllToCloud` / `saveTodayAll` 等）を
  変更するときの警告は、CLAUDE.md 本体「触るときに特に注意するロジック」を参照。

---

## 同期の仕様と注意

### save() の同期タイミング特性（2026-05-21 判明）
- `save(key, val)` は `localStorage.setItem` の後に `pushToCloud(key, val)` を呼ぶが、**await していない（fire-and-forget）**
- そのため、保存直後はローカル即時反映だが、GAS への書き込み完了までは数秒〜十数秒のラグがある
- 片方の端末で保存 → 即座にもう片方の端末でリロードすると「反映されていない」ように見えることがある
- **5〜10秒待ってからリロードすれば反映される**
- これは `save()` 経由の全ての保存処理（`addSupple` / `stopSupple` / `resumeSupple` / `saveSuppleMemo` / `deleteSuppleMemo`、および他のキー `diary` / `health_notes` / `bodyWeights` 等）に共通の特性
- バグではなく、UX 優先の意図的な設計（保存時の UI 応答性を保つため）
- 将来 UX 改善するなら「保存中インジケータ」「同期完了フィードバック」を追加する選択肢あり

### GAS同期のテスト時の鉄則（2026-05-14 のデータ消失事故を踏まえて）
- GAS同期は完了まで5分以上かかることがある
- 「同期完了」の表示が出るまで、次の操作を一切しないこと
  （リロード・別端末での操作・削除・再同期など全て）
- 同期がからむテストの前には、必ずJSON書き出しでバックアップを取る
- 複数端末をまたぐテストは「片方で同期完了を確認 → それからもう片方」の順を厳守。2台を並行して触らない
- 同期処理に関わるコードを変更するときは、特に慎重に。
  変更前に必ずバックアップ、変更後は1ステップずつ確認

### GAS Web App の挙動
- 並列スロットリング: 同時リクエストが多いと待たされる
- 稀に500エラーが返る → 失敗キーの自動リトライ実装済み（2026-05-21）
- `doPost` は単純上書き挙動（マージ判定はクライアント側）
- JSON.parse エラーキーはスキップ扱い（2026-05-21）

## 既知の落とし穴
- 〜2026-06-19まで：`syncFromCloud()` はページロード直後に非同期実行し、完了時に
  `renderAll()` → `resetDiaryForm()`（today へ無条件リセット）を呼んでいたため、
  過去日表示中に sync が完了すると表示日付が today に戻る race condition があった。
  → **2026-06-19 commit 89aeb71 で修正済み**。`resetDiaryForm()` を `reloadDiaryForm()` に
  改名し、`loadFormForDate(_currentFormDate)` で現在の表示日付を維持するよう変更。
- push back を持つ4キー（次項参照）は、2026-06-19 commit 100f94b で push back送信にも
  `filterByTombstone` が効くよう修正済み。修正前は localStorage保存にのみ適用され、
  push back送信は未適用の生マージ結果を送っていたため、削除済みidがGASへ復活する経路があった。
- カレンダー（`renderCalendar`）のドット表示は `getDiary()` を直接読む。day_memo は参照しない
- **【未解決・調査中 2026-07-04】書き戻し（push）経路の不達事象**：スマホでの編集・追加が
  GASに書き戻されず他端末に伝わらない事象を確認（受信・削除伝播は正常＝push側の問題）。
  S1合言葉認証の導入以降の観察だが原因は未確定。データ損失なし。詳細と調査方針は
  CLAUDE.md「未解決の申し送り」に集約。同期の書き戻し周りを触る際はまずそちらを参照。

### マイグレーション処理の注意点
- 起動時マイグレーションで `save()` を呼ぶ関数は使わない（同期が走って事故る）
- 形式変換はローカルのみに閉じる
- ID生成は端末非依存の決定的方式にする（端末ごとに異なるIDだと同期重複）

## push/sync の往復フロー（2026-06-14 コード調査）

> ⚠️ 以下は 2026-06-14 時点の index.html のコードを読んで記録したもの。
> 同期コードを変更したら、この節も合わせて更新すること（古いと事故のもとになる）。

同期は「送る（push）」と「受け取る（sync）」の往復で成り立つ。

### 送る側

**`save(key, val)` … データ保存の基本（単一キー）**
1. `localStorage.setItem` でローカルに即保存。
2. `_ts_` + key にタイムスタンプ（`Date.now()`）もローカル保存。
3. `pushToCloud(key, val)` を await なしで呼ぶ（送りっぱなし）。
4. `pushToCloud('_ts_' + key, ts)` も await なしで呼ぶ。
→ ローカル保存は即時、GAS送信は数秒〜数十秒後（前述の fire-and-forget 特性）。

**`pushToCloud(key, val)` … 単一キーをGASへ送る**
- GAS URL 未設定なら何もせず終了。
- `{key, value}` を JSON で POST。
- エラーは握りつぶす（表示なし）。**リトライなし。**

**`pushAllToCloud()` … 全データ一括送信（手動「全同期」ボタン用）**
1. GAS URL 未設定なら「GAS URLが設定されていません」と表示して終了。
2. 「同期中…」表示。
3. localStorage の全キーを列挙（除外: `autobackup_` / `_ts_` / `gas_url` /
   `custom_` / `view_month_*` / `selected_recipe_id`）。
   ※ `filaria_` は 2026-07-04（コミット 6178376）に除外を解除し同期対象になった。
4. `chk_` / `day_memo_` 系で空値（null・空配列・空オブジェクト）はスキップ。
5. 対象キー全部に `Date.now()` を `_ts_*` として強制上書き（＝このデバイスを最新と宣言）。
6. データキーと `_ts_` キーをセットにして bulkData を構築（null や JSON.parse エラーはスキップ）。
7. `{bulk: true, data: bulkData}` を POST。**最大4回（初回＋リトライ3回）**試みる。
8. 結果に応じてトースト表示（同期完了／○件救済／○件失敗）。

**リトライの仕組み（`pushAllToCloud` 内のみ）**
- 試行回数: 初回 + MAX_RETRY=3 ＝ 最大4回。
- 成功条件: `res.ok`（HTTP 200〜299）。
- 失敗: HTTPエラー（4xx/5xx）またはネットワーク断。
- リトライ間隔: 200ms 固定。
- 最終的に失敗したキーは `console.warn` に出力、UIには件数のみ表示。
- ※ `pushToCloud`（単一キー版）にはリトライがない点に注意。

### 受け取る側

**`syncFromCloud()` … GASから全受信してローカルとマージ（ページロード時に自動実行）**
1. GAS URL 未設定なら何もしない。
2. 「同期中…」表示。
3. `?action=getAll` で GET → 全キーを JSON オブジェクトで受信。
4. `deleted_ids`（tombstone）を最初に処理（他キーより前に削除情報を適用）。
5. 各キーをループ（除外: `autobackup_` / `_ts_` / `gas_url` / `custom_`。
   `filaria_` は 2026-07-04 に除外解除済み）。
6. 成功: 「同期済み」→ `migrateSupplements()` → `migrateNextVisitItems()` → `renderAll()`。
7. 失敗（例外）: 「オフライン」→ `renderAll()`。

### キーごとのマージ戦略（syncFromCloud 内）
キーの種類によってマージの仕方が異なる。共通して「GASが空でローカルに内容あり」なら
ローカルを守る（安全ガード）。

- **`diary`**: 日付ごとにエントリ単位でマージ。両方に内容あれば、エントリ内の `_ts` で
  LWW（Last-Write-Wins、同点はGAS優先）。GASが空ならローカル保持。
- **`health_notes`**: 日付ごとに同上。tombstone フィルタあり。
- **`supple`**: id（なければ name＝サプリ名）で LWW。GAS空なら保持。tombstone フィルタあり。
  削除（`deleteSuppleById`）は tombstone（`deleted_ids.supple`）に記録する実装済みカテゴリの
  お手本。なお薬管理（`med_list`）は削除自体がなく `status: 'ended'` の論理削除のみで配列から
  要素を取り除かないため、tombstoneの前例にはあたらない（誤解しやすいので注記）。
- **`next_visit` / `consultation_summary` / `consultation_history` / `ao_records`**:
  id で LWW。GAS空なら保持。tombstone フィルタあり。
  ローカルにあってGASにない項目は `pushToCloud` で書き戻す（push back）。
  2026-06-19 commit 100f94b 以降、この push back も `filterByTombstone` 適用後の配列を
  送るように修正済み（保存・判定・送信の3箇所で同一の適用後配列を共通参照）。
- **`filaria_history`**: `scheduledDate` 単位の union（和集合）マージ。投与履歴は追記専用の
  ため LWW 比較はせず、同日が両側にあればローカル優先。tombstone なし。GAS空なら保持。
  （`filaria_settings` は単一オブジェクトのため下記「それ以外」の汎用LWW。両キーとも
  2026-07-04／コミット 6178376 で同期対象化。経緯は CLAUDE.md
  「フィラリアデータの同期対応」参照）
- **それ以外（単純キー）**: GASのタイムスタンプ > ローカルのタイムスタンプ（または両方ゼロ）の
  ときだけ上書き。GAS値が null / 空配列なら上書きしない（安全ガード）。

### GAS側（doGet / doPost）
保存先スプレッドシート「あお健康管理AP」の data シート（A列＝キー・B列＝JSON文字列）の
扱いは [data-model.md](data-model.md) を参照。同期の往復としては:
- **`doGet`**: data シート全行を読み、`{キー: 値, ...}` の JSON オブジェクトを返す。
- **`doPost`**: 受信ボディを JSON パース。`{bulk: true, data: {...}}` 形式なら `setValues` で
  一括書き込み、`{key, value}` 形式なら1件書き込み（後方互換）。
