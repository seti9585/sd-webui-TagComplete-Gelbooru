# Third-party notices

The completion engine is derived from Dominik Reh's MIT-licensed
`a1111-sd-webui-tagcomplete`. Its original license is preserved in LICENSE.

The Gelbooru CSV and optional rebuilding script were obtained from
`eduardoabreu81/sd-webui-prompt-studio-neo`. Its combined MIT notice is retained
below. The Python builder's non-ASCII source characters were escaped for this
prototype; the underlying transformation algorithm is unchanged.

## Prompt Studio Neo notice

MIT License

sd-webui-prompt-studio-neo is a merge of two MIT-licensed projects.
Both original copyright notices are preserved below, and the MIT
license terms apply to the combined work.

Copyright (c) 2023 Physton (sd-webui-prompt-all-in-one)
Copyright (c) 2022 Dominik Reh (a1111-sd-webui-tagcomplete)
Copyright (c) 2026 Eduardo Abreu (Neo forks and unified work)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Gelbooru data

The base tag snapshot is from DraconicDragon's
`gelbooru_tags_2026-06-11_pt20_incl_ambiguous.csv`, distributed through
https://github.com/DraconicDragon/dbr-e621-lists-archive and
https://huggingface.co/datasets/DraconicDragon/Gelbooru-Tags-Full_2026-06-11 .
Prompt Studio Neo credits the archive and dataset as Unlicense / Apache-2.0.

The aliases are from deepghs/site_tags:
https://huggingface.co/datasets/deepghs/site_tags/blob/main/gelbooru.com/tag_aliases.csv .
They are attributed by Prompt Studio Neo under CC-BY-4.0:
https://creativecommons.org/licenses/by/4.0/ .

The upstream builder combines tags and aliases, resolves duplicated names using
their post counts, excludes deprecated entries, and removes aliases that are
already real tags. This prototype additionally guards those alias collisions at
runtime. The bundled CSV itself is unchanged from the downloaded upstream file.
