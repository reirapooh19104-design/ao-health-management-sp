# ao-health-management-sp 作業ルール

## プロジェクト概要
愛犬の健康記録アプリ。HTML/JavaScriptの単一ファイル構成。
GitHub Pagesで公開、GASでデータ同期。Last-Write-Wins方式の双方向同期あり。

公開URL: https://reirapooh19104-design.github.io/ao-health-management-sp/

## ⚠️ 絶対に守ること
- GAS同期の心臓部であるスプレッドシート（Googleドライブ）を**ゴミ箱に入れない**。
  - 現在の名前：「あお健康管理AP」（旧名：「あお健康管理データ」）。
  - これはコンテナバインド型GASの本体。過去にゴミ箱入りで同期が長期間
    動かなくなった事故あり（2026-05-28 復元・解決）。詳細は下記「GAS所在不明問題」参照。
  - 誤削除防止のため、Googleドライブでスター（重要マーク）を付け済み（2026-06-12）。

## 作業対象
- **編集してよいファイル**: `index.html`, `gas_code_v2.js`
- **触ってはいけないフォルダ**: `../ao-health-management/`（古いPC版・未使用）
- **`_worknotes/`**: ルートに配置（2026-06-17新設）。作業メモ用、.gitignoreで除外（GitHubには上げない）。
  `docs/` 配下は恒久ドキュメント（patterns/sync/data-model等）専用。古いhandoffメモは削除済み。

## GASコードのリポジトリ同期（2026-07-02 追記）
- **本番のGASコードは `gas_code_v2.js`（合言葉認証版）に対応している。**
  Apps Scriptエディタ側を変更したら、このファイルも必ず更新してリポジトリと一致させること。
- 背景：S1（GAS認証なし）対応時、本番GASコードがリポジトリに存在せず（エディタ側でのみ
  直接編集されていた）、現行版を手でチャットに貼り出して確認する必要があった。この反省から、
  エディタとリポジトリを常に一致させる運用に切り替える。
- 合言葉（SYNC_TOKEN）はコード内には書かず、GASのスクリプトプロパティにのみ保存する。
  そのため `gas_code_v2.js` は公開リポジトリに置いても秘密情報は漏れない。
- 旧 `gas_code.js`（認証なし・55行版）はコミット履歴にのみ存在。今後は参照しない。

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

## 振る舞いのルール
- 「ついでに」他の場所を改善するのは控える
- 未知の挙動を見つけたら、勝手に直さず先に報告する
- 専門用語（ASCII入力など）は避け、噛み砕いた言葉で説明する（例: 「半角英数字」）
- 仕様の挙動が変わって見えた時は、操作手順を一緒に振り返って原因を確認する

## 進め方の約束ごと（erisaさんとの合意事項）

### セッション運用
- 大きな機能ごとにClaude Codeのセッションを区切る（トークン節約・混乱防止）
- 複雑な機能の実装前は「ステップ0: 現状調査」を挟む
  - ただしデータ構造や既存パターンが明確な場合は省略OK
- ステップ分割の判断基準:
  - 性質が異なる変更は分割
  - 1ステップ = 1コミット = 1動作確認サイクル
- セッションリミット中断時の対応:
  - `git status` で未コミット変更の有無を確認
  - 文脈保持していれば「続けて」で再開可
  - 切れていれば `git checkout -- index.html` でロールバックして依頼文を貼り直し

### 動作確認・デプロイ
- GitHub Pages構成のアプリの動作確認は push 後に公開版で行う
- 動作確認時はURLに `?v=ハッシュ` を付けてキャッシュクリア
  - 普段の使用時は通常URLでOK、push直後の動作確認時のみ推奨
- 動作確認時のURL開きは「コピー → Chromeアドレスバーに貼り付け」推奨
- 動作確認時はGAS同期を促さない
- 同期がからむ機能の動作確認時は5〜10秒待ってからリロード

### 復旧シナリオでの鉄則
- データ復旧作業はチャット内で完結する（Claude Code経由不要）
- 同期がからむ復旧作業は最新データを持つ端末から動かす
- 該当端末でアプリを一切開かない（自動同期で消える）

### コミュニケーション
- Claude（チャット側）が依頼文を作成 → ユーザーがClaude Codeに貼り付ける流れ
- Claude Code への依頼文はコピペしやすいよう、コードブロック（```で囲む）で提示する
- Claude Code への自動承認オプションは選ばない
- 動作確認で問題発生時は、Claude Code から原因見立てを取る → 修正案を確認 → 着手 のフロー
- 新仕様の方針確認は ask_user_input_v0 や モックアップで先回りする
- 必要性が薄い機能は実装せずスキップする勇気を持つ
- 「重くなる」を理由とした作り直しは不要

### スマホChromeの保守
- 定期的に「非アクティブタブをすべて閉じる」を実行
- サイトデータ削除: 設定 → サイトの設定 → 保存データ → 該当サイト → ゴミ箱

## 触るときに特に注意するロジック
- `pushToCloud()` / `syncFromCloud()` / `pushAllToCloud()`: GAS同期の根幹
- `saveTodayAll()`: 食事日誌・健康ノートのupsert。健康メモが全空のとき health_notes の該当日エントリを削除する
- `autoBackup()`: 7日分の自動バックアップ
- `_ts_` プレフィックスのキー: LWW用タイムスタンプ
- `loadFormForDate()`: 過去日読み込みの既存機能
  ※ health memo fields（coughL, energyLv, specialNote 等）は
    diary entry 優先・day_memo フォールバックで読む設計（race condition 対策済み）

これらを変更する場合は、変更の意図と影響範囲を先に説明してから着手すること。

## 同期の注意点（2026-06-14 追記）
- pushToCloud は fire-and-forget で成否を返さない。保存しても1回でGASに
  届かないことがある。重要な保存後は getAll でGASを確認し、未達ならもう一度保存する。
- 削除したID（deleted_ids に入ったID）は原則使い回さない。同じIDで項目を
  作り直すと tombstone と衝突して復活できないことがあるため、新規追加は常に新IDで行う。

## メンテナンスモード（作業中フラグ）（2026-06-16 追記）
- 同期がからむ修正作業（孤児ID掃除・データ修正など、巻き戻りリスクのある作業）の前に必ずONにする。
- 効果：起動時の自動同期（受信のみ）をスキップ。スマホのバックグラウンド化→リロードで古いGASデータが降ってきて修正が巻き戻る事故を防ぐ。
- 操作：画面下「GAS URL設定」ボタン → モーダル最下部「メンテナンスモード：OFF/ON」トグル。ON中は画面上部にオレンジの警告バナーが常時表示。
- localStorageキー：maintenance_mode（値 'on' でON／削除でOFF）。
- 止まるのは起動時の自動 syncFromCloud のみ。手動「全データGAS同期」「pushAllToCloud()」は従来どおり動く。
- 【運用】巻き戻りリスクのある作業を始める際は、作業前にONにする。作業完了後は必ずOFFに戻す（ON放置すると別端末の更新が届かなくなる）。

## 既知の落とし穴（2026-06-15 追記）

### 1. tombstone（deleted_ids）への正規項目ID誤混入
- custom_*項目（custom_health_checks / custom_meal_checks）の削除操作の過程で、
  現役の正規項目のIDが deleted_ids に誤って混入することがある。
- 2026-06-15、水分補給（health_1781424886148）でこの事故が発生。
  スマホのローカル deleted_ids.custom_health_checks に水分補給IDが入り込み、
  syncFromCloud の filterByTombstone がGASから降りてくる正規データを弾き続けていた。
- tombstoneはGAS側だけでなく各端末のローカル側も汚染しうる（ローカル側が盲点）。
- 一度入ると同じIDの正規データを同期で永久にブロックする。
- 教訓：削除IDの使い回し禁止。削除・重複整理の経路で正規IDが混入しないようガードが必要。

### 2. chk_<日付> 同期マージの取りこぼし（断片が完全データに勝つ）
- chk_<日付>（チェック状態・{id: bool}形式）の同期マージで、
  不完全な断片データが完全なデータに勝って上書きし、データを取りこぼすことがある。
- 2026-06-15、6/13で発生。PC側は11項目フルだったが、スマホ側が {meal_am: true} の
  断片に化けており、リロード（sync）してもPC側の完全データが降りてこなかった。
- 疑い：chk_のマージが「日付キー単位のLWW（後勝ち）」になっており、_tsの新しい断片が勝つ。
  項目単位マージ・_ts管理になっていない可能性。
- →【対策済み 2026-06-15】syncFromCloud に chk_ 専用の項目単位 OR マージブロックを追加。
  true は消えない設計になった（コミット f136992）。

### 3. 項目IDの変更時、過去のchk_<日付>に古いIDが孤児として残留する
- チェック項目（custom_health_checks等）のIDを変更・再作成すると新IDが生成されるが、
  過去のchk_<日付>に書き込まれた{古ID: true}はそのまま残り続ける。
- migrateCheckItems()は定義配列に_ts/orderを付与するだけで、過去chk_には触れない。
  項目ID変更時に過去chk_を新IDへ移行する処理は存在しない。
- 結果、画面には出ない（getAllCheckIdsに含まれないため）が、localStorage/GASには
  古IDのチェック実績が幽霊として残る。
- 2026-06-15に発覚：water→health_1781424886148（水分補給）、
  meal_1780052409076→meal_1781424971693（夜ごはん）の旧IDが過去chk_に残留し、
  6/13などで同一項目が新旧2つのIDで重複していた。
- 整理方針：古IDのチェック実績は「その日やった記録」なので削除せず、対応する新IDにOR統合する。
  ラベル一致での自動マッピングは将来の同名項目で誤動作しうるため、対応付けは手動確認する。
- 【解決 2026-07-04・掃除完了】棚卸しの結果、実際に残っていた孤児は3種と判明：
  walk（35日分）・meal_am（53日分）・meal_1781424971693（49日分）。いずれも
  「ユーザーが使わなくなったチェック項目（散歩・朝ごはん・夜ごはん系）の過去実績」で、
  現役項目への統合先は無かった（当初想定の「ID変更による分断→OR統合」ではなく、
  「不要項目の記録が残存」が実態だった）。そのため移行マイグレーションではなく
  **掃除**を実施し完了。Mac・スマホ・GASの3か所から対象3IDを削除
  （chk_ はORマージ同期のため3か所同時に消さないと復活する＝落とし穴5への対応）。
- 掃除手順の要点（将来また孤児が出た＝削除→再追加をした場合に再利用可能）：
  ① エクスポート＋対象IDのみのピンポイント退避（2重バックアップ）
  ② 各端末でドライラン（件数確認）→ 実行（対象IDのキー完全一致のみ削除・他は不触）
  ③ GAS側は一時関数でJSONパース＆キー完全一致削除（ドライラン→実行、終わったら関数削除）。
     **pushAllは使わない**（空{}のchk_は送信スキップされGAS側の孤児が残るため。
     全キーへの_ts_強制上書きの副作用も回避）
  ④ メンテモードOFF→両端末リロード→棚卸しで0種を複数回確認（復活しないこと）
- 空になった chk_<日付>（2026-05-12/05-14/05-31）は {} のまま残置（無害）。
- day_memo の "walk"（散歩メモ・自由記入欄）は chk_ の孤児 walk とは別データで、
  掃除は無関係（触れていない）。
- 再発防止の状況：編集ではIDが変わらない（saveMealItemEdit等はID保持）ため、
  孤児の新規発生源は「削除→再追加」のみ。実績の自動削除はしない既定方針は維持し、
  将来また溜まったら上記手順で掃除する。

### 4. pushToCloudはfire-and-forgetで成否を返さない（再確認）
- pushToCloud（約1196行）はawait fetchの例外をcatch{}で握りつぶし、成否を呼び出し元に返さない。
- save後にGASへ届かなくてもコンソールに何も出ない。過去日編集でも経路は今日と同じ（別経路ではない）。
- 確実にGASへ上げたいときは pushAllToCloud()（リトライ・進捗ログ付き）をコンソールで直接呼ぶのが堅い。
- 単発で確実に送るfetch形式：POST / Content-Type:text/plain / body=JSON.stringify({key, value})。

## 既知の落とし穴（2026-06-16 追記）

### 5. 起動時の自動同期（項目単位ORマージ）でtrueが消えない → クリーンアップは全端末で必要
- アプリ起動時、PC・スマホとも必ず syncFromCloud が走る。
- chk_ の同期は項目単位の OR マージ（既知の落とし穴2の対策）になっているため、「true は消えない」方向に動く。
- 結果、GAS側で孤児IDを削除しても、いずれかの端末のローカルに残っていれば、同期で消えずに復活・残存する。
- 教訓：データのクリーンアップ（孤児ID削除など）を行う場合、GASで消すだけ・1端末で消すだけでは不十分。
  関係する各端末で個別に削除操作を行う必要がある。

### 6. ローカル修正→pushAllToCloud前に同期を挟むと、GASの古いデータで巻き戻る
- ローカルを修正してGASに反映する作業では、push の前に syncFromCloud が走ると、
  GAS側の古いデータでローカルの修正が巻き戻ることがある。
- 対策：「ローカル修正 → 同期を挟まず即 pushAllToCloud()」の順を厳守する。
- アプリのリロード・タブ切り替え・画面操作が同期の引き金になりうるため、
  修正〜push の間はアプリを一切触らない。

### 7. チェック操作は押すたびに即GAS送信（デバウンスなし）→【対策済み 2026-06-17】
- 今日タブのチェック（食事・薬・サプリ・耳の様子・レメディー等）は `<div class="check-item">` の
  onclick → toggleCheck() → setChecks() → save()。保存ボタンは無い。
- save() は localStorage保存に続けて pushToCloud(本体) と pushToCloud(_ts_) を呼ぶ＝1チェックで2リクエスト。
  差分ではなくその日の chk_<日付> 全体をフルスナップショット送信。
- リスクだった内容：連打時にネット遅延差で古いスナップショットが新しいものを追い越してGASに後着
  →GASは上書きのみのため古い方が勝つ（既知の落とし穴2「断片が完全データに勝つ」と同じメカニズム）。失敗は画面に出ない。
- 【対策済み・第1段階 2026-06-17／コミットb094c5e】save() 内で key が `chk_` 始まりの場合のみ
  pushToCloud を1.5秒デバウンス。`_chkPushTimers` / `_chkPushPending`（いずれもグローバルオブジェクト、
  chk_<日付>キーごとに独立管理）で保留・タイマーを保持。chk_以外のキーは従来どおり即時送信のまま。
- 【対策済み・第2段階 2026-06-17／コミット8ed502c】デバウンス保留中に離脱（タブ閉じ・リロード・
  バックグラウンド化）すると保留分が送信されない問題への対策として `flushChkPending()` を追加。
  `visibilitychange`（hidden時）と `pagehide` の両方で発火し、`_chkPushPending` 内の全キーを
  `fetch(..., {keepalive:true})` でまとめて送信。送信前にタイマー停止＋保留delete済みなので二重送信なし。
- sendBeaconは不採用（GASのexec URLがリダイレクトを伴いブラウザ依存で不安定なため、fetch+keepaliveを選択）。
- 【実機検証済み 2026-06-17・公開版GitHub Pagesで確認】
  - 第1段階：連打してもchk_本体＋_ts_の2件のみにまとまることを確認（取りこぼしなし）。
    日付またぎ（今日＋過去日）も、それぞれ独立して1セットずつ送信されることを確認。
  - 第2段階：チェック押下直後にvisibilitychange(hidden)を発生させ、keepalive=trueのfetchが
    2件（chk_本体＋_ts_）出ることを確認。離脱時flushが正しく動作。

## 既知の落とし穴（2026-06-19 追記）

### 8. filterByTombstoneのid/date欠落要素ガード（対策済み）
- filterByTombstone（index.html 1299行〜）は、item.idもitem.dateも両方undefinedの要素が来ると、
  照合キーが String(undefined)="undefined" に縮退する構造的リスクがあった。
  deleted_idsに"undefined"という文字列が混入すると、id・date両方を持たない要素が一括削除される経路が存在した。
- 【対策済み 2026-06-19】id・date両方undefinedの要素は照合をスキップして常に保持、
  かつ照合キーが"undefined"になった場合も保持する二重ガードを追加（コミットb1fd5e1）。
  既存の通常系（idを持つ要素のtombstone判定）の挙動は変更していない。
- next_visit/consultation_summaryのレガシー文字列要素は3端末実態調査で「存在しない」ことを確認済み。
  そのためマイグレーションは見送り、予防ガードのみ追加した（再調査時はこの前提を疑ってよい）。
- 今後filterByTombstoneを触る際は、このガード（id/date欠落要素を保持する分岐）を外さないこと。

### 9. pushToCloud / flushChkPendingの失敗可視化（R-2・観察用、対策済み）
- pushToCloud（1224行〜）とflushChkPending（1236行〜）のcatchで、
  ネットワーク例外発生時に [push失敗] プレフィックス付きでconsole.errorを出すようにした（コミット61e1214）。
  「再発時に証拠を残す」ための観察用であり、根本対応ではない。
- これらはfire-and-forget（await無し）で、res.okを見ていないためHTTPエラー(4xx/5xx)は検知しない。
  捕まえられるのはネットワーク例外（fetch自体が投げる例外）のみ。
- 「チェックしたのに別端末に来ない」が再発した場合の切り分け順：
  1. Consoleで [push失敗] の有無を確認 → 2. GASスプレッドシートのchk_を確認。
- ★根本対応（リトライ・res.ok判定・空catchの見直し）は原因特定後に限る。
  keepalive送信（flushChkPending）は繊細なため、原因不明のまま構造を変えないこと。

## 既知の落とし穴（2026-06-20 追記）

### 10. 項目マスターの全削除は同期で他端末に伝播しない
- custom_meal_checks / custom_health_checks を「空配列」にすると、GASも空になる。
- しかし syncFromCloud のマージ処理（custom_meal_checks/custom_health_checks）は
  GAS側が空配列のとき isEmpty 判定で早期 return し、ローカルの古いデータに一切触れない
  （filterByTombstone 行に到達しない）。
- このマージは「GAS側に値があるときの復活防止＋マージ」専用であり、
  「ローカルにある古い項目の掃除」は行わない。
- 結果：ある端末で項目を全削除しても、他端末のローカルには古い項目が残り続け、
  リロード（同期）しても消えない。tombstone でも消せない（tombstoneは復活防止用で、
  ローカル既存データのクリーンはしない）。
- 対処：各端末で個別にローカルを直接空にする必要がある。
  例）localStorage.setItem('custom_meal_checks', JSON.stringify([]))
  またはアプリUIの編集モード→ゴミ箱削除（deleteMealItem経由）。
- 実例（2026-06-20）：PCで食事チェック（朝ごはんmeal_am・夜ごはんmeal_1781424971693）を
  削除→GAS空になったが、スマホのローカルに両項目が残存。スマホでローカル直接クリアして解決。
  push back対象4キー（next_visit/consultation_summary/consultation_history/ao_records）に
  custom_meal_checks は含まれないため、スマホの古いデータがGASを巻き戻す危険は無かった。

## 印刷機能（buildAndPrint）（2026-06-28 追加）
- 今日タブ下部の管理ボタン列に「📄 病院用に印刷」ボタンを追加（index.html 内）。
- `buildAndPrint()` 関数がセクションA〜FのHTMLを動的組み立てし、`#print-container` に注入して `window.print()` を呼ぶ。
- `@media print` で `body > *:not(#print-container)` を非表示にし、印刷コンテナだけを表示する。
- **固定情報の編集**：名前・犬種・避妊・食事・アレルギー・既往・ホメオパシー・参考情報は `PRINT_CONSTANTS`（`const DENSITY` の直後付近）にまとめて定義。`reference` キーは `\n` 区切り文字列で管理し、div 分割＋`margin-bottom:6pt` で項目間に余白を付けて表示。
- **ワクチン欄**：`#pane-notes .vaccine-card` の静的HTMLをDOM読み取りで取得（localStorageとは無関係）。
  - `.vaccine-detail` の `innerHTML` 取得時に `<br>` 前後の改行＋インデントが混入して `\n\n` になる問題があり、split/trim/filter/join で圧縮している（詳細は落とし穴11）。
- **セクション構成（2026-07-01 時点）**：A. 基本情報・アレルギー（ホメオパシー・参考情報を含む）、A'. ご相談したいこと（`getNextVisitItems()` 全件）、B. サプリ・薬、以降は C〜F。
- **データ取得元**：体重＝`getBodyWeights()` の直近10件、サプリ＝`getSupple()`、薬＝`getMedList()`、レシピ＝`getRecipes()`＋`_currentRecipeId`、血液検査＝`getBloodTests()`、あおの記録＝`getAoRecords()`、次回来院時＝`getNextVisitItems()`。

## 既知の落とし穴（2026-06-28 追記）

### 11. innerHTML取得時にbr前後の改行＋インデントが混入し空行が生まれる
- HTMLソース上で `<br>` の前後に改行＋インデントスペースがある場合、`.innerHTML` を取得すると
  `\n　　　テキスト<br>\n　　　次のテキスト` のように取得される。
- `<br>` を `\n` に置換しただけだと `\n\n` が生まれ、`white-space:pre-line/pre-wrap` 下では空行として描画される。
- **対処パターン**：`innerHTML` 取得 → `<br>` を `\n` に変換 → `split('\n')` → 各行 `trim()` → 空行 `filter()` → `join('\n')`。
  現在 `buildAndPrint()` のワクチン欄処理に実装済み（コミット40fd9c1）。

## 次回来院・次回診察まとめ欄のUI（2026-07-01 追加）

### クリック展開方式（共通パターン）
- 「次回来院時に伝えること」と「次回診察用まとめ」の両欄でクリック展開方式を採用。
- あおの記録タブ（`_aoRecordExpandedId` + `toggleAoRecordExpand`）が原型。
- 展開状態変数：`_nvExpandedIdx`（インデックス管理）/ `_csExpandedId`（ID管理）
- 展開時のみ操作ボタンを表示。ボタンには `event.stopPropagation()` で誤開閉防止。
- ボタンは `btn-supple` スタイル（あおの記録タブに準拠）。

### 次回来院時に伝えること（`renderNextVisitItems`）
- 各項目をクリックで展開し、展開中に「編集」「削除」ボタンを表示（`_nvExpandedIdx` で管理）。
- 編集：インライン textarea で本文を書き直し、保存で更新。
- 旧形式（文字列のみの古い項目）は、編集保存時に `{id, text, _ts, ...}` の新形式へ自動アップグレード。
- 削除：`confirm` 確認後に実行。新形式のみ tombstone（`next_visit`）に登録。

### 次回診察用まとめ（`renderConsultationSummary`）
- 4ケース構成でレンダリング：
  - ケース1 `isEditOpen`：本文編集 textarea
  - ケース2 `isResultOpen`：本文＋診察結果テキスト＋結果 textarea＋編集/削除ボタン
  - ケース3 `isExp`（展開中・通常）：本文＋診察結果テキスト＋「診察結果を記入/編集 ▼」＋編集/削除ボタン
  - ケース4（閉じた状態）：本文＋診察結果テキストのみ
- 展開状態は `_csExpandedId` で管理、`toggleCsExpand(id)` で開閉トグル。
- `openConsultationResult(id)` は `_csExpandedId = id` も同時にセット（結果フォームを開くと展開状態を維持）。

## 既知の落とし穴（2026-07-03 追記）

### 12. unauthorized応答のデータ混入とstatusキー衝突（対策済み・掃除済み）
- getAll のレスポンスは**トップレベルにデータキーが直接並ぶ構造（ラッパーなし）**。
  認証エラー時だけ `{status:'error', message:'unauthorized'}` という**2キーのみ**の形になる
  （gas_code_v2.js の unauthorizedResponse）。
- 事故の経緯：S1認証導入直後、**旧キャッシュ版アプリ**（token付与なし・statusチェックなし）が
  unauthorized応答を**データとして**localStorageに保存（status/message キー）→ その後の
  「全データGAS同期」でシートに status / message / _ts_status / _ts_message の**行として書き込まれ**、
  以降のgetAll正常データ（344キー）に `status:'error'` が恒久混入した。
- 結果、単純な `gasData.status === 'error'` 判定が誤爆して「合言葉を確認してください」を表示。
  さらに判定直後の early return で**起動時の受信同期が毎回まるごと中断していた**
  （送信は生きているため気づきにくい。認証自体は一度も壊れていなかった）。
- 【対策済み 2026-07-03／コミット b3c930b】syncFromCloud の unauthorized 判定を三条件に強化：
  `gasData.status === 'error' && gasData.message === 'unauthorized' && Object.keys(gasData).length <= 2`
  本物のunauthorized応答は構造上必ず2キーのみなので誤爆は構造的に不可能。
  **この回りくどい三条件を「冗長」として単純化しないこと**（単純化すると本事故が再発する）。
  なお POST 応答（pushToCloud / pushAllToCloud）は常にラッパー形式でデータと混ざらないため、
  そちらの `status==='error'` 判定は現状のままで安全。
- 教訓1：認証判定にデータと衝突しうるキー名（status等）を使う場合は、キー数・message等の
  複数条件で本物を構造的に切り分けること。
- 教訓2：unauthorized応答など「データでないもの」が一度 localStorage→シートに書き込まれると、
  以降のgetAllに恒久混入する。**pushAllToCloudの収集フィルタが除外しないキーは何でもシートに
  上がる**ことを意識する（status/message はフィルタ対象外だった）。
- 教訓3（汚染キー掃除時）：正規データの**中身**に同名の文字列が含まれることがある
  （例：urso_setting の値内の `"status":"active"`）。シートの汚染行削除は**A列のキー名の
  完全一致**で判断し、検索ヒットを機械的に消さないこと。
- 汚染掃除は 2026-07-03 完了：シートと全端末（Mac・スマホ）のlocalStorageから上記4キーを削除し、
  同期・全データGAS同期後も書き戻しがないことを確認済み。

## 合言葉（SYNC_TOKEN）ローテーション手順（2026-07-03 追記・実施済み）
- **GASのスクリプトプロパティ SYNC_TOKEN の変更に再デプロイは不要**（毎リクエスト実行時に読まれる）。
- 手順：両端末メンテナンスモードON → GASのSYNC_TOKENを新値に変更 → Macの設定モーダルで
  新値を保存（保存直後に受信同期が自動で1回走り「同期済み」まで進めばその場テスト成功。
  この自動同期は**メンテナンスモード中でも走る仕様**） → スマホも同様 → 両端末メンテOFF →
  リロードで同期完走を確認。
- 確認は `localStorage.getItem('sync_token').length`（文字数照合）と
  「合言葉を確認してください」が出ないこと。**合言葉の実値はチャット・記録類に絶対に書かない**
  （実値はGoogleパスワードマネージャーで管理）。
- 最大の落とし穴：**GASのスクリプトプロパティは前後の空白をトリムしない**（アプリ側入力はtrim済み）。
  貼り付け時の空白・改行混入で永久不一致になるため、GAS側保存後に目視確認する。
- ロールバック：GASのSYNC_TOKENを旧値に戻すだけで、未変更端末は即復旧する。

## 起動時の自動同期の性質（2026-07-04 調査で確定）
- 結論：**条件付き双方向**。受信（getAll→キー別マージ）が主体だが、
  syncFromCloud 内に4キー限定の書き戻しpushが常設されている（経路④）。
- 起動時にpushが走りうる経路は4つ：
  - 経路①：migrateSupplements()。移行が発生したときのみ setSupple→save→pushToCloud
  - 経路②：initConsultationKeys()。consultation_summary / consultation_history キー不存在の初回のみ
  - 経路③：renderAll内の setBloodTests / setNotes。blood_tests / health_notes キー不存在の初回のみ
  - 経路④：syncFromCloud の書き戻しpush（下記。定常運用でも条件が成立しうる）
- 経路④の対象4キー：next_visit / consultation_summary / consultation_history / ao_records。
  マージ後「ローカルにあってGASに無い項目」が1つでもあれば、その配列を pushToCloud する。
- 全キーを無差別に押し上げる起動時pushは存在しない。pushAllToCloud（ボタン/コンソールのみ）・
  flushChkPending（visibilitychange/pagehideのみ）は起動時には走らない。
- 補足：メンテナンスモードがスキップするのは syncFromCloud のみ。起動時のmigrate系・
  初回init（経路①〜③）はメンテONでも走り、GAS送信が出うる。

## 既知の落とし穴（2026-07-04 追記）

### 13. 経路④の書き戻しpushによるゴミ項目の再注入（対策済み）
- 上記4キーに id/date 欠落などの壊れた項目（tombstoneに入っていない不正データ）が残ると、
  起動のたびに書き戻しpushでGASへ再注入され続ける。filterByTombstone は id→date の順で照合し
  両方欠落の要素は常に保持するため、id/date欠落エントリは「削除もブロックもできない
  不死身のゴミ」になる。
- 【対策済み 2026-07-04／コミット 6001b93】経路④のpush直前に整合チェック（_filterForPushBack）を追加。
  キー別バリデータ（_validNextVisitEntry 等4つ）で壊れた項目をpush対象から除外する。
  - 骨格チェック（必須フィールドの有無と型）のみで、値域（source/category の値等）は見ない。
  - next_visit / consultation_summary の文字列レガシーエントリは正当として通す。
  - 除外発生時のみ console.warn を1行出す（正常時は無音。warnが出たらそれ自体が発見）。
  - localStorage保存・受信マージ・tombstone・LWWは無変更。**ローカルからは削除しない**
    （push対象から外すだけ）。
- 重要：nullエントリが1個あると、キー関数（nvKey等）の `null.id` 参照で syncFromCloud 全体が
  TypeError→「オフライン」表示で中断する。**「配列要素は文字列または non-null オブジェクト」が
  全キー共通の最低ライン**。
- 【対策済み 2026-07-04／コミット b0e8f26】受信マージにも null ガードを導入。
  syncFromCloud のマージで、ローカル/GAS配列の null・非オブジェクト要素を Map構築前に除外
  （_isSaneEntry / _saneEntries）。判定は「文字列 or non-nullオブジェクト」の最低ライン一本のみ
  （骨格チェックはしない）。対象は8キー（diary / health_notes / supple /
  custom_meal_checks / custom_health_checks / next_visit / consultation_summary /
  consultation_history / ao_records）。
  - 注意：受信ガードは push側と異なり「ローカル残置」ができない。マージ結果は必ず
    localStorage に上書き保存されるため、弾いた null はローカルからも消える。
    これは push側の「削除しない」原則の意図的な例外（null はJSON上の「無」でデータではない）。
  - 補足：受信ガードで骨格チェックをしないのは、正当な旧形式エントリ（フィールド欠落）を
    弾くと端末に降りてこなくなり、受信後修復（migrateNextVisitItems等）と衝突するため。
    役割分担＝受信ガード：クラッシュ防止（null除去）／push側ガード：GAS衛生（骨格不良を送らない）。

### 14. フィラリア「初回日を変更」で設定が即消える（修正済み）
- 旧 resetFilariaSettings が「初回日を変更」ボタン押下時に即 removeItem していたため、
  新しい日付を保存し切らずにフォームを離脱（閉じる・リロード等）すると filaria_settings が
  失われた。実際に 2026-07-04 にこの事故が発生（Macで設定消失。履歴 filaria_history は
  別キーのため残存＝「設定だけ消える」症状）。
- 今日以前から存在した既存バグで、同日のバックアップ実装（47f98be）は無関係と調査で確認済み
  （import は `if (d.filariaSettings)` ガードで null を書き込めない構造）。
- 【修正済み 2026-07-04／コミット f131eba】removeItem を廃止し編集モード方式
  （_filariaEditOpen フラグ）に変更。「変更」ボタンは openFilariaEdit（フォームを開くだけ）に、
  設定の切り替えは保存時（saveFilariaFirstDate）の上書きに一本化。変更→キャンセルで設定が
  残り、編集中もカレンダーの投与印が消えなくなった。

## フィラリアデータの同期対応（2026-07-04）
- filaria_settings / filaria_history は実装当初（2026-05-29／コミット 070384a）から同期除外
  だったが、**理由は未記録の意図的設計**だった（GASスプレッドシートのゴミ箱事故復旧の翌日で
  安全側に倒した可能性があるが推測の域）。調査で端末固有値・秘密情報を含まないことを確認し、
  ユーザー意向により同期対象化した。
- 【対応済み 2026-07-04／コミット 6178376】setter を save() 化（_ts_刻印＋push付与）、
  受信フィルタ・pushAllToCloud 収集フィルタの除外2箇所を解除。
  - filaria_settings：単一オブジェクトのため汎用LWW（専用マージなし）。
  - filaria_history：scheduledDate キーの union（和集合）マージ。追記専用データのため
    LWW比較せず和集合。同日はローカル優先・tombstone不要・受信nullガード適用。
- 初回投入手順：正データを持つ端末で「全データGAS同期」を1回実行 → GASに
  filaria_settings / filaria_history と _ts_ 行が入り、他端末はリロードで受信
  （pushAllToCloud の強制_ts刻印により投入元の値が正になる）。実機確認済み。
- 補足：filaria_history と chk_<日付> の filaria_today は二重管理のまま
  （履歴＝恒久記録／chk_＝当日チェックUI。両者とも単調増加型の同期で発散しない）。

## 次回の検討タスク（2026-07-04 更新）
- 起動時の自動同期が双方向か片方向かの調査 → 解決済み（2026-07-04）。
  結論は「起動時の自動同期の性質」セクション参照。書き戻しの整合チェックも導入済み
  （落とし穴13・コミット 6001b93）。
- 受信マージ側のnullガード：ローカル/GASの配列にnullエントリがあると、
  Map構築時のキー関数（nvKey等）で TypeError→sync全体が中断する経路
  →【対策済み 2026-07-04／コミット b0e8f26】8キーの受信マージに最低ラインガードを導入。
  詳細は落とし穴13。
- 過去chk_の孤児ID移行マイグレーション → 解決済み（2026-07-04）。棚卸しの結果、
  実態は「ID変更による分断」ではなく「不要項目の実績残存」だったため、移行ではなく
  掃除（Mac・スマホ・GASの3か所同時削除）で対応完了。詳細と再利用可能な手順は落とし穴3参照。
  これで既知の残タスク（孤児ID・exportギャップ・起動時同期・null経路）は一通り解消。
- exportData / importData の custom_meal_checks / custom_health_checks ギャップ
  → 解決済み。実は 77c465f（2026-06-18）で対応済みだったことが 2026-07-04 の棚卸しで判明。
  加えて 47f98be で deleted_ids / recipes / selected_recipe_id / filaria /
  migrationフラグ（ao_records_migrated_v2）の漏れも解消（export は ver:4・後方互換あり）。
- audit残項目（2026-07-04 棚卸し。詳細な状況・優先順位は docs/audit-2026-07.md の
  「対応状況」「修正の推奨順序」を参照。B3・B5・S4疎通確認は同日対応済みでクローズ）：
  - B1（受信マージの空配列early-return）：【解決 2026-07-04／d3577e7 パイロット＋3f56fde 横展開】
    6ブロック（supple / custom_meal_checks・custom_health_checks / next_visit /
    consultation_summary / consultation_history / ao_records の7キー）の isEmpty early-return を
    除去し、GAS空でも filterByTombstone に必ず到達する health_notes 同型に統一。nodeスタブ27ケース
    ＋実機でPC→スマホの削除伝播を確認。B2（血液検査・体重・薬のtombstone未対応）は別課題として未対応のまま。
  - B4（flushChkPendingの2フェッチ不整合）：静観継続。再発の実証が着手条件（落とし穴9参照）。
  - S5（CDNの完全バージョン固定＋SRI）：保留。SRIハッシュの取得と公開版での動作確認が必要。

## 未解決の申し送り（2026-07-04 発見・次セッションで調査）

### スマホの編集・追加がGASに書き戻されず他端末に伝わらない（原因未確定・調査中）
- **症状**：スマホで項目を編集・追加すると、スマホのローカルには保存され画面にも出るが、
  GASスプレッドシート（dataタブ）に反映されない（「テスト編集A」で検索して0件）。
  そのため他端末（PC）に伝わらない。B1実機確認中（2026-07-04）に発見。
- **切り分け済み**：これは受信マージではなく**書き戻し（push）側**の問題。
  - PC→スマホの削除伝播は成功、PC内での編集反映も正常。壊れているのはスマホからの送信のみ。
  - 本日のB1変更（受信マージの early-return 除去）は書き戻し・認証に触れていないため無関係。
- **時系列の観察（因果は未確定）**：S1で合言葉認証を導入（8422087・054413d）して以降、
  スマホで編集する際にブラウザが script.google.com のパスワード自動入力ポップアップを
  出すようになった（以前は出なかった）。ただしポップアップは画面外タップで閉じており、
  これが書き戻し不達の原因かどうかは**未確定**。
- **データ損失なし**：スマホ・GAS・PCのいずれにも元データは無事。
- **次アクション**：次の独立セッションで、スマホのコンソールで**書き戻しの瞬間のログ／エラー**を
  観察してから調査を始める（推測で直さない）。pushToCloud は fire-and-forget で失敗を握りつぶす
  ため（落とし穴4・9）、まず [push失敗] ログの有無・fetch の実行有無・認証エラーの有無を見る。
- **繊細案件**：合言葉（SYNC_TOKEN）・GAS認証にからむため、着手前に方針相談する。
  手順書を先に作り、1ステップずつ確認しながら進める（いきなりコードを変えない）。

## 運用ルール（恒久）
- 各セッションで、コードや同期の挙動について新たに確定した知見・落とし穴・
  教訓を得た場合は、このCLAUDE.md の該当セクションに簡潔に追記すること。
  ただし未解決・調査中の事項は「確定仕様」としては書かず、解決後に追記する。

## 設計パターン集

設計パターンは [docs/patterns.md](docs/patterns.md) を参照。

## トラブル対処

トラブル対処は [docs/troubleshooting.md](docs/troubleshooting.md) を参照。

## erisaさんの傾向
- 「数十秒前のことは覚えてない」のでUI上で状態保持を頑張りすぎない方向が良い
- モックアップで色相関・配置を先回り確認するのが有効
- 仕様の意味確認は丁寧にしたい派（挙動が変わって見えた時は理由を一緒に考える）

## ドキュメント索引
- [docs/sync.md](docs/sync.md) … 同期の仕様と罠（最重要）
- [docs/data-model.md](docs/data-model.md) … データ構造の前提
- [docs/patterns.md](docs/patterns.md) … 設計パターン集
- [docs/troubleshooting.md](docs/troubleshooting.md) … トラブル対処・デプロイ手順
- [docs/decisions.md](docs/decisions.md) … 設計判断の経緯
- [docs/roadmap.md](docs/roadmap.md) … 繰り越し課題（P1/P2/P3優先度つき）
- [docs/history.md](docs/history.md) … 完了済みタスク・バージョン履歴
