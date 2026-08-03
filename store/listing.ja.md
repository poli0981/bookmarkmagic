# Chrome Web Store listing — 日本語

Translated from `listing.en.md`, keeping its structure. Register: です／ます,
katakana loanwords (ブックマーク, インポート, エクスポート, フォルダ), per
`docs/07 §4`.

⚠️ `TODO(review-ja)` — like the in-app dictionary, this is best-effort until a
native pass (`docs/00 §10.9`). Review before relying on it for a listing edit.

**Name:** `BookmarkMagic` (brand name — never translated)

**Summary** (63 / 132 characters — CJK counts by character, so this is short):

```
ブラウザ間でブックマークをインポート・エクスポート・編集。オフライン、アカウント不要、クラウド不要。データは端末から出ません。
```

**Description:**

```
ブックマークをブラウザ間で移すいちばん簡単な方法は、ファイルを使うことです。
アカウント不要、クラウド同期なし、完全オフラインで動作します。

できること
• ブックマークファイル（HTML、JSON、CSV）をインポートします。書き込む前に
  必ずプレビューを表示し、件数・フォルダ・重複を先に確認できます。
• インポート方法を選べます。日付付きの新しいフォルダに入れる（安全な既定
  値）、既存のフォルダに統合する、またはすべて置き換える（この場合は安全
  のためのバックアップを先にダウンロードします）。
• 重複したブックマークは自動でスキップできます。
• すべて、または選んだフォルダだけを HTML（Chrome、Edge、Brave、Firefox、
  Safari、Vivaldi、Opera で利用できます）、JSON、CSV、Markdown に
  エクスポートできます。
• ブックマークツリーを編集できます。検索、名前の変更、ドラッグ＆ドロップ、
  フォルダの作成、削除、重複リンクの検出。

設計としてのプライバシー
• すべて端末上で動作します。サーバーも、分析も、トラッキングもありません。
• 権限は 2 つだけです。「bookmarks」（本来の目的）と「storage」（設定の
  保存）。それ以外は要求しません。
• 無料・オープンソース（GPL-3.0）です。コードは GitHub で確認できます。

対応言語
English · Tiếng Việt · 日本語

制限事項（正直に）
• ファビコンはインポートできません。ブラウザのブックマーク API に
  ファビコンの項目がないためです。
• インポートしたブックマークの日付は本日の日付になります。拡張機能が
  ブックマークの元の作成日を設定することを Chrome が許可していないためです。
  エクスポートしたファイルには本来の日付が残ります。
• CSV はフラットな形式です。空のフォルダや「どれがブックマークバーか」は
  保持されません。忠実なバックアップには HTML か JSON をお使いください。

ソースコード、問題の報告、プライバシーポリシー:
https://github.com/poli0981/bookmarkmagic
```

法的文書は英語のみです（`docs/14`）。プライバシーポリシーの URL は EN 版と
同じものを使います。
