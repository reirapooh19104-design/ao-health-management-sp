# トラブル対処・デプロイ手順

（デプロイが反映されない等の対処手順。困った時に開く。※後日移行）

### GitHub Pages デプロイが反映されない時
1. Settings → Pages → Source は「Deploy from a branch」のまま
2. Branch のプルダウンを「None」に変更して Save
3. 「GitHub Pages source saved.」が出るのを確認
4. 30秒ほど待つ
5. Branch を「main / (root)」に戻して Save
6. 「Your GitHub Pages site is currently being built from the main branch.」と表示されれば成功
7. Actions タブで新しい pages build and deployment エントリ（緑チェック）を確認
8. 公開URLに `?v=ハッシュ` を付けて動作確認

### キャッシュバスト `?v=ハッシュ` の意味
- ブラウザは過去に開いたURLの内容をキャッシュ（保存）する性質がある
- 同じURLを再訪問すると、サーバーから取り直さずキャッシュを使うことがある
- push 直後は最新コードに更新したいので、`?v=ハッシュ` で「未訪問URL」に見せかける
- ブラウザは「初めてのURLだから取りに行く」と判断 → 最新コードを必ず取得
- 普段の使用時は通常URLでOK・push直後の動作確認時のみ `?v=ハッシュ` 推奨

## 既知の落とし穴（同期コード関連）

### push back送信は filterByTombstone 適用後の配列を送ること（2026-06-19判明・修正済み）
- `syncFromCloud` 内で push back（GASへの書き戻し）を行うキーは、保存・判定・送信の
  3箇所すべてで同一の「tombstone適用後」配列を参照しないと、生のマージ結果を送ってしまい
  削除済みidがGASへ復活する。
- 2026-06-19以前は `next_visit` / `consultation_summary` / `consultation_history` /
  `ao_records` の4キーでこの抜け穴があった（localStorage保存だけ適用後、push back送信は
  適用前の生配列）。commit 100f94b で修正済み。
- 今後 push back を持つキーを追加する場合は、同じ落とし穴を踏まないよう
  「filterByTombstoneは1回だけ呼び、その結果を全箇所で共通参照する」を徹底する。

### 要観察：pushToCloudの失敗は無音で握りつぶされる
- `pushToCloud` は内部で `catch {}` しており、失敗（ネットワーク断・GAS側エラー等）しても
  呼び出し元に何も返さず、画面にも何も出ない。
- 「チェックしたのに別端末に来ない」など同期の取りこぼしを疑う場合：
  1. まずGAS側のスプレッドシート（data シート）で該当の `chk_<日付>` キーの値を確認する。
  2. 値が無い／古いままなら、まず「離脱時のflush取りこぼし」（デバウンス保留中にタブを閉じた等）
     を疑う。`flushChkPending()` は `visibilitychange`（hidden）と `pagehide` で発火するが、
     それ以外の離脱経路（強制終了等）では保留分が送られない可能性がある。
  3. 確実に送りたい場合は `pushAllToCloud()`（リトライ・進捗ログ付き）をコンソールで直接呼ぶ。
