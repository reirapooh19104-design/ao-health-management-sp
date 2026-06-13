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
