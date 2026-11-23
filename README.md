# sd-webui-TagComplete-Gelbooru

An independent extension based on **DominikDoom's a1111-sd-webui-tagcomplete**.
It keeps the upstream completion engine and adds a Gelbooru dictionary with
automatic and manual dictionary switching.

## Intended hosts

| Host | Auto mode |
|---|---|
| Forge Neo, UI Preset `anima` | Gelbooru |
| Forge Neo, any other preset | Danbooru |
| Original Forge / reForge | Danbooru |

Simulated-host checks pass. The dictionary switching was also checked in
reForge and Forge Neo by the extension user; original Forge remains untested on a real host.

## Install and run

1. No additional libraries are required in an existing WebUI environment.
2. In Extensions > Installed, disable the existing TagComplete extension and any
   Prompt Studio Neo / TagComplete Neo installation. Apply the change and close WebUI.
   Keep their folders and your existing configuration; do not uninstall them.
3. Remove the earlier `extensions/sd-webui-tagcomplete-gelbooru` folder if you
   installed a prototype, then extract the ZIP so the extension is at
   `extensions/sd-webui-TagComplete-Gelbooru/`.
   The `scripts`, `javascript`, and `tags` directories must be directly inside it.
4. Start WebUI using your normal shortcut. From PowerShell in the WebUI root,
   the standard launch command is ` .\webui-user.bat `.
5. Refresh the browser with Ctrl+F5.

Example extraction for Neo, using PowerShell:

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\sd-webui-TagComplete-Gelbooru.zip" -DestinationPath "F:\sd-webui-forge-neo\extensions"
```

Do not run two copies of TagComplete together: they share JavaScript names,
settings keys, temporary path files and API routes.

## Dictionary controls

The `Tag Autocomplete` top-level tab holds the dictionary switch. The selected
dictionary controls both positive and negative completion, as well as supported
third-party fields, without taking space from the prompt inputs.

| Mode | Behavior |
|---|---|
| Auto | Gelbooru for the Neo `anima` UI preset; otherwise Danbooru |
| Danbooru | Danbooru regardless of the UI preset |
| Gelbooru | Gelbooru regardless of the UI preset |
| Use Tag filename setting | Honor the existing Tag filename setting exactly, including custom lists or None |

Manual tab choices are saved in this browser for this WebUI address. They
override the settings default. Select Auto in the tab to resume automatic
switching. txt2img and img2img share one choice.

Settings > Tag Autocomplete > Dictionary mode sets the default. Applying a
different default resets the tab override. Applying the same default does
not clear a saved toolbar choice.

Auto and Danbooru modes use the configured Tag filename if its name starts with
`danbooru` and ends with `.csv`; otherwise they use the bundled `danbooru.csv`.
The fourth mode keeps the original custom-list feature available, including e621.

The active dictionary appears next to the control. Switching closes existing
suggestions and blocks their insertion until the replacement dictionary is ready.
A missing Gelbooru file falls back to Danbooru and displays a warning. If both
are unavailable, normal tag suggestions are empty; other completion parsers
remain enabled. Restore the files and restart WebUI/browser to reload them.

## Retained completion behavior

- Existing TAC search, aliases, translations, frequency sorting and keyboard controls.
- LoRA, LyCORIS, embeddings, hypernetworks where the host supports them, wildcards,
  YAML wildcards, chants and style variables.
- Existing underscore, parentheses, comma and spacing settings.
- Existing `tac_` settings keys; no automatic rewrite of existing prompts.
- The bundled Gelbooru list contains 235,255 tags. Its real tag names take priority
  over alias redirects. Examples include `eyes_closed`, `sole_female`,
  `bellybutton` and `hair_past_waist`.
- Artist completion using `@` is the existing optional TAC setting. An explicitly
  typed `@` is retained on artist insertion even if automatic prefixing is off.

See [the original documentation](README_UPSTREAM.md) for the inherited features.
The upstream Japanese and Chinese documentation is retained for reference.

## Quick real-host checks

1. On Neo, select `anima` in UI Preset, leave the Tag Autocomplete tab in Auto, and confirm
   `gelbooru.csv` appears. Type `sole_female` and confirm Tab inserts `sole female`
   when underscore replacement is enabled.
2. Select `xl` or `sd`; confirm the active dictionary changes to Danbooru.
3. Select Gelbooru manually and change the preset; confirm it stays Gelbooru.
4. Return to Auto; confirm it follows the current preset again.
5. On original Forge and reForge, confirm Auto uses Danbooru, then test manual Gelbooru.
6. Test ordinary positive/negative prompts, `<l:` LoRA completion, `<e:` embedding
   completion and `__` wildcard completion using your installed files.
7. If using TIPO, test its Tag Prompt field separately. Do not assume every
   third-party layout/version matches the inherited selectors.

For rollback, disable this extension, re-enable your previous TagComplete,
restart WebUI and refresh the browser. Existing option keys remain usable.
This folder has its own usage-frequency database; the previous extension's
frequency history is not automatically copied.

## Development verification

The archive includes test sources. They are optional and are not loaded by WebUI.

```powershell
node .\tests\frontend_smoke.cjs
python .\tests\host_smoke.py
```

The frontend test uses Node.js built-ins and a simulated DOM with the actual
TAC parsers and bundled dictionaries. The backend test uses Python with PyYAML
(already present in standard WebUI environments) and simulated host APIs.
Neither test performs GPU image generation or certifies real Gradio rendering.
See [VALIDATION_ja.md](VALIDATION_ja.md) for the prototype's verification limits.

---

# sd-webui-TagComplete-Gelbooru

**本家 a1111-sd-webui-tagcomplete の補完機能を基にした独立拡張です。**
Gelbooru辞書と、NeoのAnima選択に連動する自動切替・手動切替を追加しました。

## 導入方法

1. **追加ライブラリのインストールは不要**です。既存のWebUI環境を使います。
2. 「Extensions > Installed」で、従来のTagCompleteを無効にします。
   Prompt Studio NeoやTagComplete Neoも入っている場合は無効にしてください。
   設定を適用してWebUIを終了します。フォルダーを削除する必要はありません。
3. 旧試作の`extensions/sd-webui-tagcomplete-gelbooru`フォルダーがある場合は、
   WebUIを終了した状態で取り除きます。ZIPをWebUIの`extensions`へ展開し、
   `extensions/sd-webui-TagComplete-Gelbooru/scripts`という配置になることを確認してください。
4. 普段のショートカットからWebUIを起動します。
   PowerShellを使う場合の標準起動コマンドは、WebUI本体フォルダーで` .\webui-user.bat `です。
5. ブラウザーでCtrl+F5を押します。

**従来のTagCompleteと同時に有効にしないでください。** 補完処理が重複します。

## 使い方

WebUI上部の「Tag Autocomplete」タブに辞書切替が表示されます。プロンプト欄の
表示領域は使用しません。
切替は両タブ・ネガティブ欄にも共通して適用されます。

| 選択 | 動作 |
|---|---|
| Auto | NeoでUI Presetが`anima`ならGelbooru。それ以外はDanbooru |
| Danbooru | Danbooruに固定 |
| Gelbooru | Gelbooruに固定 |
| Use Tag filename setting | 従来の「Tag filename」設定をそのまま使用 |

初期設定はAutoです。本家Forge／reForgeでは、AutoはDanbooruを使用します。
手動選択はモデル切替より優先し、同じブラウザー・WebUIのアドレスで保持します。
**自動切替へ戻すときは、欄でAutoを選んでください。**

「Settings > Tag Autocomplete > Dictionary mode」は初期モードの設定です。
初期モードを別の値へ変更して適用すると、ブラウザー側の手動選択を解除します。
同じ値のまま適用した場合は解除しません。

現在の辞書名は切替欄の横に表示します。切替時には候補を閉じ、古い辞書の候補を
確定できないようにします。プロンプトに既に入力済みのタグは書き換えません。

e621や独自辞書を使いたい場合は、従来の「Tag filename」を設定して、
「Use Tag filename setting」を選びます。
Auto／Danbooruでは、指定ファイルがDanbooru系のCSVならそのファイルを使い、
それ以外は同梱の`danbooru.csv`を使います。

通常の候補表示・矢印キー・Tab／Enterによる確定、LoRA・Embedding・
ワイルドカードなどは本家TagCompleteの機構を引き継いでいます。
`@`によるArtist補完は、従来の設定で有効にできます。

Gelbooru辞書がない場合はDanbooruへ戻し、切替欄の横に警告を表示します。
両方の辞書がない場合も画像生成を停止させず、通常タグの候補を空にします。
辞書を元に戻した後、WebUIとブラウザーを再起動してください。

## 実機で確認すること

1. NeoのUI Presetを`anima`にし、Autoで`gelbooru.csv`になること。
2. `sole_female`を入力し、TabでGelbooruの表記が入ること。
   アンダースコアを空白にする設定なら、`sole female`になります。
3. UI Presetを`xl`や`sd`へ変更するとDanbooruへ戻ること。
4. Gelbooruを手動選択した後は、UI Presetを変えてもGelbooruを維持すること。
5. 本家Forge／reForgeでは、AutoでDanbooru、手動でGelbooruを使えること。
6. 正・負のプロンプト欄、LoRA、Embedding、ワイルドカードの補完が使えること。
7. TIPOを使う場合は、Tag Prompt欄でも確認してください。

**こちらでの検証は模擬環境です。Windows実機のNeo／Forge／reForgeでの動作と、
実際のGradio画面の表示は未確認です。**

元に戻す場合は、この拡張を無効にして従来のTagCompleteを有効にし、
WebUIを再起動してブラウザーを更新します。以前の設定項目は引き続き使えます。
使用頻度の履歴は拡張フォルダー内の別データベースになるため、自動移行しません。

---

## License, acknowledgements and sources / ライセンス・謝辞・典拠

- Code: MIT; retain the upstream notices in [LICENSE](LICENSE).
- Original completion engine: [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete),
  commit `4170882f90b47be130a0ff9314f663c230b9153d`.
- Gelbooru dictionary and rebuilding script:
  [Eduardo Abreu's Prompt Studio Neo](https://github.com/eduardoabreu81/sd-webui-prompt-studio-neo).
  The original merged-project notice is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Gelbooru tag snapshot: [DraconicDragon/dbr-e621-lists-archive](https://github.com/DraconicDragon/dbr-e621-lists-archive)
  and [Gelbooru-Tags-Full](https://huggingface.co/datasets/DraconicDragon/Gelbooru-Tags-Full_2026-06-11).
- Gelbooru aliases: [deepghs/site_tags](https://huggingface.co/datasets/deepghs/site_tags), CC-BY-4.0;
  aliases colliding with real tag names are removed by the upstream builder and guarded again at load time.
- Anima guidance: [CircleStone Labs Anima model card](https://huggingface.co/circlestone-labs/Anima).
- Neo preset interface: [modules_forge/main_entry.py](https://github.com/Haoming02/sd-webui-forge-classic/blob/neo/modules_forge/main_entry.py)
  and [presets.py](https://github.com/Haoming02/sd-webui-forge-classic/blob/neo/modules_forge/presets.py).

The code license and tag-data licenses are separate. See the source projects for
their individual data notices. The bundled rebuild tool is optional and contacts
the upstream data providers when explicitly run; normal completion uses local files.
