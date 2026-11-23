# TagComplete Gelbooru 試作 Rev1 検証記録

作成日：2026-10-05

## 結果

| 検証 | 結果 | 範囲 |
|---|---|---|
| フロント側の動作 | 32項目 PASS | 実際の補完コード・辞書を使い、画面部品は模擬 |
| Neoの読み込み | PASS | NeoのAPIを模したPython環境 |
| 本家Forgeの読み込み | PASS | 従来APIを模したPython環境 |
| reForgeの読み込み | PASS | 従来APIを模したPython環境 |
| JavaScriptの構文 | 全ファイル PASS | Node.jsの構文検査 |
| Pythonの構文・ASCII | 全ファイル PASS | 構文解析とASCII文字の確認 |
| Windows実機・Gradio表示 | 未確認 | ユーザー環境での確認が必要 |
| GPUを使った画像生成 | 未実施 | この試作は入力補完の拡張 |

「3環境で実機動作確認済み」という意味ではありません。
模擬環境では実際のWebUIやモデルを起動していません。

## 確認した内容

- AutoでNeoのUI Presetが`anima`ならGelbooru、それ以外はDanbooru。
- Neoの選択欄がない環境では、AutoはDanbooru。
- 手動Danbooru／GelbooruがUI Presetの選択より優先。
- Autoへ戻すと現在のUI Presetへ再び追従。
- txt2imgとimg2imgの切替欄を共通の選択へ同期。
- 設定の初期モードを別の値へ変更した場合の手動選択解除。
- Danbooru系の追加辞書と、従来設定をそのまま使うモード。
- 実際のGelbooru辞書235,255件の読み込み。
- `eyes_closed`、`closed_eyes`、`sole_female`、`bellybutton`、`hair_past_waist`の存在。
- 実在するタグが別名として別タグへ誘導されないこと。
- `<o>_<o>`など、先頭が山括弧のタグを辞書読み込みで落とさないこと。
- TagComplete本体の検索から`sole_female`を見つけ、Tabで`sole female`を挿入。
- LoRA・Embedding・ワイルドカードの従来パーサが利用されること。
- 辞書切替中の候補確定を抑止。
- UI Presetの変更を定期確認する前でも、旧辞書の候補を確定しないこと。
- 非同期検索の途中に辞書が変わった場合、旧検索結果を表示しないこと。
- 旧辞書の読み込みが遅れて完了しても、最新の選択を上書きしないこと。
- Gelbooruがない場合のDanbooruへの復帰。
- 両辞書がない場合も、ほかの補完パーサを無効にしないこと。
- バックエンドの設定登録・一時ファイル作成・LoRAのファイル一覧作成。
- Neoで`force_reload`引数がないEmbedding再読み込み関数への対応。
- 従来環境では`force_reload`を渡して再読み込みすること。
- Embedding一覧が空でも、新しいファイルを確認するための再読み込みを行うこと。
- モデル未読み込み時にEmbeddingの処理で止まらないこと。

## 実機で未確認の内容

- 本物のGradioでの切替欄の配置・表示・テーマとの組み合わせ。
- 各ホストでのブラウザー更新後のスクリプト読み込み順と、他拡張との組み合わせ。
- 実モデルの読み込み前後におけるLoRA・Embedding一覧とプレビュー。
- TIPOなど、各バージョンの第三者拡張の入力欄との組み合わせ。
- 使用頻度データベースの実機での読み書き。

本家のAPIや設定を引き継いだ部分も、今回のWindows実機確認の代わりにはなりません。
確認手順はREADMEの日本語セクションに記載しています。

## 基盤と配布内容

本家TagCompleteのコミットは`4170882f90b47be130a0ff9314f663c230b9153d`です。
補完エンジンと各補完パーサをそのまま基盤にし、辞書切替、読み込み競合の抑止、
Neo／従来環境のEmbedding再読み込み引数の違いへの対応を追加しました。

辞書・コード・README・ライセンス・テストをすべてZIPに同梱しています。
辞書の出典とSHA-256は`BUILD_INFO.json`、著作権表示とデータの典拠は
`THIRD_PARTY_NOTICES.md`に記載しています。
