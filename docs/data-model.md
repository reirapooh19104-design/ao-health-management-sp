# データ構造の前提

ao-health-management-sp のデータ構造・キー名・保存先・同期方式の前提をまとめる。
データを触る前に必ず読む。

## データ構造の前提
- `diary` エントリの日付: ISO形式 `YYYY-MM-DD`
- `health_notes` エントリの日付: `YYYY/M/D` または `YYYY/M/D夜` 形式
- `diary` / `day_memo` は日付ベースでupsert（空値でも上書き）
- `health_notes` は健康メモに内容があればupsert、全空保存時は該当日エントリを削除（2026-05-18 修正）
- `diary` エントリには health memo fields（walk, coughN, coughL, energyLv, specialNote, memoOther）も含まれる
  ※ day_memo との二重保存。読み込みは diary entry 優先
- `bodyWeights` は配列：`[{date: "YYYY-MM-DD", weight: 数値kg}, ...]`
  - 日付昇順でソート保持、同一日付は upsert（既存上書き／新規追加）
  - `pushAllToCloud` / `syncFromCloud` で配列丸ごと置換で同期（`health_notes` と同方式）
  - `exportData` / `importData` の対象に含まれる
  - 7日分の自動バックアップ対象に含まれる（autoBackup が全キーを自動収集）

## ao_records のデータ構造（2026-05-24 確定）
- 病院履歴タブを「あおの記録」に改名・拡張
- カテゴリ: 病院 / 体調 / 行動 / 食事 / ケア / その他
- 状態変数: `_aoRecordSelectedYear` / `_aoRecordCategoryFilter` / `_aoRecordSearchQuery`
- 関数:
  - `normalizeAoRecordDate`: 漢数字日付対応の日付正規化
  - `getAoRecordSortKey`: ソート用キー生成（正規表現は具体的な形式を先に置く）
  - `getAoRecordYears`: 年タブ生成用
- `renderHospital` のフィルタ順序: ソート → 年 → カテゴリ → 検索 → 描画
- migrate v2: 端末非依存の決定的ID方式（端末ごとに異なるIDを生成すると同期で重複する）

## キー名の使い分け
- localStorage: スネークケース（例: `health_notes`, `body_weights`）
- JSON書き出し: キャメルケース（例: `healthNotes`, `bodyWeights`）

## 同期方式の確立済み一覧
- 配列丸ごと置換方式: `health_notes` / `bodyWeights` / `supple` / `next_visit` / `consultation_summary` / `consultation_history` / `ao_records`
- LWW（Last-Write-Wins）方式: 上記以外の単純なキー
- 削除の同期は tombstone（`deleted_ids`）で10カテゴリ実装済み：
  `custom_meal_checks` / `custom_health_checks` / `health_notes` / `supple` /
  `next_visit` / `consultation_summary` / `consultation_history` / `ao_records` /
  `learning_memos` / `learning_categories`（learning_categoriesは削除UIなし・予防適用）。
  push back（GASへの書き戻し）を持つキーは5つ（next_visit/consultation_summary/
  consultation_history/ao_records ＋ 2026-07-06追加の learning_memos）。
  うち従来4キーは2026-06-19にtombstone適用漏れを修正済み（history.md参照）。
  `med_list`（薬管理）・`recipes` は対象外（med_listは`status:'ended'`の論理削除で要素を消さない、
  recipesはそもそもtombstone未実装）。

## 学びメモ（learning_memos / learning_categories）（2026-07-06 追加）
- `learning_memos`：学びメモ本体の配列。1件＝
  `{ id:'lm_<ts>_<乱数>', date:'YYYY-MM-DD', category:<カテゴリid>, title, course,
     format('Zoom'|'対面'|'動画'|'その他'), content, reaction, next, link,
     mastery(1〜4: 習いたて/練習中/できた/定着した), _ts }`
  テキスト系は任意（未入力はUI上ラベルごと非表示）。骨格必須は id / date / _ts
  （push-back整合チェック `_validLearningMemoEntry` の判定対象）。
- `learning_categories`：ユーザー定義カテゴリの配列。1件＝
  `{ id, label, fill(淡い塗り色), solid(濃色), _ts, order }`
  初期3件は固定id（`lcat_kintore` / `lcat_massage` / `lcat_praise`）でキー不存在の
  初回のみシード（固定idなので複数端末が独立にシードしても同期で重複しない）。
  追加カテゴリは `lcat_<ts>_<乱数>`・未使用色をLM_PALETTEから自動割当。
- 同期方式：learning_memos＝ao_records同型（エントリ単位LWWマージ＋tombstone＋push-back）、
  learning_categories＝custom_meal_checks同型（id単位LWWマージ＋tombstone・push-backなし）。
  両方とも受信nullガード（_saneEntries）適用・isEmpty early-returnなし（B1方針）。
- エクスポート：ver 5 から `learningMemos` / `learningCategories` を含む。
  インポートはid単位unionマージ（同idは_tsの新しい方を採用）。

## サプリの status フィールド
- サプリには `status: 'stopped'`（中止）という値がある。
- 詳しい運用（サプリ削除など機能別仕様）は [patterns.md](patterns.md) を参照。

## データの保存場所と形式（2026-06-12 調査・宿題C）
データは二段構え。

- **主保存先＝端末内の localStorage**
  - 普段アプリが読み書きするのはこちら。表示が速く、オフラインでも動く。
- **副保存先＝スプレッドシート「あお健康管理AP」の data シート**
  - クラウドのバックアップ兼・端末間同期用。
  - 形式：A列＝キー名、B列＝JSON文字列（1行1キー）。
  - GAS側 `doPost` が書き込み、`doGet` が `JSON.parse` でオブジェクトに戻す。
  - 同期の往復フロー（pushAllToCloud / syncFromCloud）の詳細は [sync.md](sync.md) を参照。

「シートが空に見える」原因は仕様どおりで異常ではない:
- ① アプリが描画するのは localStorage であってシートではない。
- ② データはデフォルト表示タブではなく `data` タブにある。

### 体重データ（bodyWeights）
- キー名は `bodyWeights`、形式は `[{date: "YYYY-MM-DD", weight: 数値}, ...]` の配列。
- `diary` とは完全に独立。GAS同期対象。
- 2026-06-12 に data シートで実データ確認済み
  （2026-05-19〜06-07、2.8〜2.97kg・あおらしい現実的な値で同期も正常）。
- ⚠️ **混同注意**: あおの体重(kg)＝`bodyWeights` と、食事の食材合計重量(g)＝`diary` 内 `d-weight` は別物。
  名前が似ているので、今後コードを触るとき要注意。

この保存方法（localStorage主＋スプレッドシート同期）は設計として妥当。変更不要。
