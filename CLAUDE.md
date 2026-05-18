# ao-health-management-sp 作業ルール

## プロジェクト概要
愛犬の健康記録アプリ。HTML/JavaScriptの単一ファイル構成。
GitHub Pagesで公開、GASでデータ同期。Last-Write-Wins方式の双方向同期あり。

## 作業対象
- **編集してよいファイル**: `index.html`, `gas_code.js`
- **触ってはいけないフォルダ**: `../ao-health-management/`（古いPC版・未使用）

## 作業前に必ずやること
1. `git status` で現在の状態を確認
2. 未コミットの変更があれば、着手前にコミットすること:
```
   git add .
   git commit -m "作業前セーブポイント: <これからやること>"
```
3. ユーザーから別途指示がない限り、新しいブランチは切らずmainで作業してよい

## 作業後にやること
1. 変更内容を箇条書きで要約して報告（行番号含む）
2. ユーザーが動作確認OKと言うまでコミットしない
3. OKをもらってからコミット:
```
   git add .
   git commit -m "<やったことの要約>"
```
4. `git push` は明示的に頼まれた時だけ実行する

## 触るときに特に注意するロジック
- `pushToCloud()` / `syncFromCloud()` / `pushAllToCloud()`: GAS同期の根幹
- `saveTodayAll()`: 食事日誌・健康ノートのupsert。健康メモが全空のとき health_notes の該当日エントリを削除する
- `autoBackup()`: 7日分の自動バックアップ
- `_ts_` プレフィックスのキー: LWW用タイムスタンプ
- `loadFormForDate()`: 過去日読み込みの既存機能
  ※ health memo fields（coughL, energyLv, specialNote 等）は
    diary entry 優先・day_memo フォールバックで読む設計（race condition 対策済み）

これらを変更する場合は、変更の意図と影響範囲を先に説明してから着手すること。

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

## 振る舞いのルール
- 大きな変更の前に方針を1〜2文で要約して合意を取る
- 「ついでに」他の場所を改善するのは控える
- 未知の挙動を見つけたら、勝手に直さず先に報告する
- 不明点はユーザーに質問する（推測で進めない）

## 既知の落とし穴
- `syncFromCloud()` はページロード直後に非同期実行し、完了時に `renderAll()` → `resetDiaryForm()` を呼ぶ
  → フォーム編集中に sync が完了するとフォームが上書きされる（race condition）
  → `loadFormForDate()` の diary entry 優先読みで緩和済みだが、初回保存前には注意
- カレンダー（`renderCalendar`）のドット表示は `getDiary()` を直接読む。day_memo は参照しない

## GAS同期のテスト時の鉄則（2026-05-14 のデータ消失事故を踏まえて）
- GAS同期は完了まで5分以上かかることがある
- 「同期完了」の表示が出るまで、次の操作を一切しないこと
  （リロード・別端末での操作・削除・再同期など全て）
- 同期がからむテストの前には、必ずJSON書き出しでバックアップを取る
- 複数端末をまたぐテストは「片方で同期完了を確認 → それからもう片方」の
  順を厳守。2台を並行して触らない
- 同期処理に関わるコードを変更するときは、特に慎重に。
  変更前に必ずバックアップ、変更後は1ステップずつ確認

## 【未完了】健康ノート 4/17〜5/13 復旧タスク

### 状況
5/14の事故で消失した健康ノートのうち、4/17〜5/13 範囲が `healthNotes` 配列に戻っていない。
5/18 時点で確認済み（JSONエクスポートで欠落確認）。

### データの生存状況
- `healthNotes` 配列：4/17〜5/13 のエントリ無し
- `diary` 配列：同期間のエントリは残存。walk / coughL / energyLv / specialNote / memoOther にデータあり
→ diary から再構築可能

### 復旧方針案
1. diary 配列から 4/17〜5/13 の各エントリを抽出
2. walk / coughL / energyLv / specialNote / memoOther を結合して `healthNotes[].text` を再構築
3. `healthNotes` 配列に追加、日付昇順を維持
4. ローカルで動作確認 → JSON書き出しで再確認 → 別端末で確認
5. その上で GAS同期（完了表示を必ず待つ）

### 注意点
- 日付形式の違い：`healthNotes` は `"2026/5/16"`（スラッシュ・ゼロ埋めなし）、diary は `"2026-05-16"`（ハイフン・ゼロ埋め）。変換コードが必要
- 復旧前に必ず JSON バックアップ
- 「健康ノート同期バグ修正」（最優先・別タスク）→「復旧」の順がよい。バグが残ったまま復旧するとまた消える可能性

### 関連
- 「健康ノート同期バグ修正」（削除が片方向同期）と密接に関連
