# Chrome Web Store listing — 简体中文

Translated from `listing.en.md`, keeping its structure. Chrome's own zh-CN terms
(书签, 书签栏, 文件夹, 导入, 导出), full-width punctuation, and a half-width space
between Han characters and Latin text or numbers, per `docs/07 §4`.

⚠️ `TODO(review-zh)` — like the in-app dictionary, this is best-effort until a
native pass (`docs/00 §10.13`). Review before relying on it for a listing edit.

**Name:** `BookmarkMagic` (brand name — never translated)

**Summary** (47 / 132 characters — CJK counts by character, so this is short):

```
在浏览器之间导入、导出和编辑书签——离线运行，无需账户，无需云端。您的数据绝不会离开您的设备。
```

**Description:**

```
在浏览器之间转移书签，最简单的方式就是用一个文件。无需账户，没有云同步，
100% 离线运行。

功能
• 导入书签文件（HTML、JSON、CSV）——包括您个人资料文件夹中 Chrome 自己的
  “Bookmarks”文件和 Firefox 的 JSON 备份。写入任何内容之前都会先完整预览：
  数量、文件夹和重复项一目了然。
• 自选导入方式：放入一个带日期的新文件夹（安全的默认选项）、合并到您已有的
  文件夹，或全部替换（会准确显示将删除的内容，并先保存一份安全备份）。
• 可以跳过您已有的链接。
• 导出全部书签，或只导出您选择的文件夹，格式可选 HTML（适用于 Chrome、
  Edge、Brave、Firefox、Safari、Vivaldi、Opera）、JSON、CSV 或 Markdown。
• 编辑书签树：搜索、重命名、拖动以移动或重新排序、将文件夹按 A→Z 排序、
  新建文件夹、删除，以及查找重复的链接。

隐私至上的设计
• 完全在您的设备上运行。没有服务器，没有分析，没有跟踪。
• 只有两项权限：“bookmarks”（核心功能）和“storage”（保存您的设置）。
  仅此而已。
• 免费且开源（GPL-3.0）——可在 GitHub 上查看代码。

语言
English · Tiếng Việt · 日本語 · 简体中文 · Română

局限（坦诚说明）
• 无法导入网站图标——扩展程序的书签 API 没有网站图标字段。
• 导入的书签日期为今天——Chrome 不允许扩展程序设置书签的原始创建日期。
  您导出的文件会保留真实日期。
• CSV 是扁平化的视图：空文件夹以及“哪个文件夹是书签栏”都不会保留。
  如需完整备份，请使用 HTML 或 JSON。

源代码、问题跟踪和隐私政策：
https://github.com/poli0981/bookmarkmagic
```

法律文件仅有英文版本（`docs/14`），隐私政策 URL 与英文版相同。
