# Gelbooru辞書を公式APIから更新する

Gelbooru公式APIからタグを取得して、`tags/gelbooru.csv` を更新します。外部のタグ一覧配布元は使用しません。標準では前回の取得日から90日以上経過した場合だけ取得します。最初の同梱辞書は2026年6月11日のデータとして扱います。

- 追加ライブラリのインストール: 不要（Python標準ライブラリのみ）。WebUIのPythonを使用してください。
- 更新日だけ確認: `venv\Scripts\python.exe extensions\sd-webui-TagComplete-Gelbooru\tools\update_gelbooru_from_api.py --status`
- 更新を開始・中断後に再開: `venv\Scripts\python.exe extensions\sd-webui-TagComplete-Gelbooru\tools\update_gelbooru_from_api.py`
- 90日を待たずに更新: 同じコマンドの末尾に `--force` を付けます。

上記コマンドはWebUIのフォルダで実行してください。拡張フォルダ名を変えた場合はパスも合わせて変更してください。取得には多数のリクエストが必要で、数時間かかる場合があります。APIが認証を要求する場合は、環境変数 `GELBOORU_USER_ID` と `GELBOORU_API_KEY` の両方を設定してから実行してください。取得を途中で止めても、同じコマンドで続きから再開できます。

取得が完了するまで現在の辞書は保持します。更新完了後にWebUIを再読み込みしてください。公式のタグAPIは別名を返さないため、更新後の辞書には旧データ由来の別名は含めません。

この試作はWebUI起動時に自動で大量の取得を開始しません。更新するかどうかの判定と取得は上記コマンドで行います。
