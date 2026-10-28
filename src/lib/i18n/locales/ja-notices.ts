import type { Dict } from './en';

/** Japanese warnings and errors — mirrors en-notices.ts (docs/07 §2). */

export const warnings = {
  NO_BOOKMARKS: {
    one: 'このファイルにブックマークは含まれていません。',
    other: 'このファイルにブックマークは含まれていません。',
  },
  DESCRIPTIONS_DROPPED: {
    one: '説明 {n} 件を破棄しました。ブックマークのモデルに該当する項目がありません。',
    other: '説明 {n} 件を破棄しました。ブックマークのモデルに該当する項目がありません。',
  },
  FAVICONS_IGNORED: {
    one: 'ファビコン {n} 件を無視しました。ブックマーク API はファビコンを設定できません。',
    other: 'ファビコン {n} 件を無視しました。ブックマーク API はファビコンを設定できません。',
  },
  INVALID_DATE: {
    one: '読み取れない日付 {n} 件を空欄にしました。',
    other: '読み取れない日付 {n} 件を空欄にしました。',
  },
  MISSING_URL: {
    one: 'アドレスのない項目 {n} 件をスキップしました。',
    other: 'アドレスのない項目 {n} 件をスキップしました。',
  },
  NEWER_VERSION: {
    one: 'このファイルは新しいバージョンで作成されています。可能な範囲で読み込みます。',
    other: 'このファイルは新しいバージョンで作成されています。可能な範囲で読み込みます。',
  },
  EMPTY_TITLE: {
    one: 'タイトルのないブックマークが {n} 件あります。ブラウザーでは代わりにアドレスが表示されます。',
    other:
      'タイトルのないブックマークが {n} 件あります。ブラウザーでは代わりにアドレスが表示されます。',
  },
  INVALID_URL: {
    one: 'ブラウザーが保存できないアドレスの項目が {n} 件あったため、スキップしました。',
    other: 'ブラウザーが保存できないアドレスの項目が {n} 件あったため、スキップしました。',
  },
  PLACE_QUERIES_SKIPPED: {
    one: 'Firefox のスマートブックマーク（ウェブページではなく保存された検索）を {n} 件スキップしました。ここではリンク切れになるためです。',
    other:
      'Firefox のスマートブックマーク（ウェブページではなく保存された検索）を {n} 件スキップしました。ここではリンク切れになるためです。',
  },
  EXTRA_ROOTS_SKIPPED: {
    one: 'ブラウザー固有のフォルダー（Opera のスピードダイヤルやゴミ箱など）にあるブックマーク {n} 件はインポートしませんでした。',
    other:
      'ブラウザー固有のフォルダー（Opera のスピードダイヤルやゴミ箱など）にあるブックマーク {n} 件はインポートしませんでした。',
  },
  UNREADABLE_ENTRIES: {
    one: '読み取れない項目が {n} 件あったため、スキップしました。',
    other: '読み取れない項目が {n} 件あったため、スキップしました。',
  },
} satisfies Dict['warnings'];

export const errors = {
  NOT_NETSCAPE: 'ブックマークの HTML ファイルではないようです。',
  NOT_BM_JSON: 'この JSON ファイルは BookmarkMagic が作成したものではありません。',
  MALFORMED_JSON: 'このファイルは有効な JSON ではありません。',
  INVALID_NODE: 'BookmarkMagic が読み取れない項目が含まれています。',
  BAD_CSV_HEADER: 'CSV のヘッダー行がないか、列の順序が正しくありません。',
  CSV_ROW_MISMATCH: 'CSV の行の列数が正しくありません。',
  CSV_UNCLOSED_QUOTE: 'CSV の引用符が閉じられていないため、ファイルの残りを正しく読み取れません。',
  UNKNOWN_FORMAT: 'ファイルを認識できません。ブックマークの HTML、JSON、CSV が必要です。',
  FILE_TOO_LARGE: 'このファイルは大きすぎてインポートできません。',
  TOO_MANY_NODES: 'このファイルには安全にインポートできる数を超えるブックマークがあります。',
  TOO_DEEP: 'このファイルはフォルダの入れ子が深すぎます。',
  BACKUP_SERIALIZE_FAILED: 'バックアップを準備できなかったため、何も変更していません。',
  BACKUP_CANCELLED: 'バックアップがキャンセルされたため、何も削除していません。',
  BACKUP_WRITE_FAILED: 'バックアップを保存できなかったため、何も削除していません。',
  BROWSER: 'ブラウザがブックマークの操作を拒否しました。',
  NO_WRITABLE_ROOTS:
    'このブラウザプロファイルには、BookmarkMagic が書き込みを許可されているブックマークフォルダがありません。組織によって管理されているブックマークは変更できません。',
  PARTIAL_WRITE: 'インポートの途中で、ブラウザがブックマークの受け付けを停止しました。',
  PARTIAL_CLEAR: 'ブックマークを置き換えている途中で、ブラウザが停止しました。',
  UNKNOWN: '問題が発生しました。',
} satisfies Dict['errors'];
