import type { Dict } from './en';

/**
 * Japanese — です/ます form, katakana loanwords (docs/07 §4).
 * TODO(review-ja): owner reviews VI; JA is best-effort until a native pass.
 */
export default {
  common: {
    appName: 'BookmarkMagic',
    import: 'インポート',
    export: 'エクスポート',
    edit: '編集',
    settings: '設定',
    about: '概要',
    busy: 'インポートを実行中です',
    cancel: 'キャンセル',
    comingSoon: '{tab}は今後のビルドで利用できます。',
  },
  popup: {
    import: 'ブックマークをインポート…',
    export: 'ブックマークをエクスポート…',
    manage: 'マネージャーを開く',
    counts: 'ブックマーク {bookmarks} 件 · フォルダ {folders} 件',
  },
  import: {
    dropHint:
      'ブックマークファイルをドロップするかクリックして選択してください — .html、.json、.csv · 最大 {size}',
    reading: '{name} を読み込んでいます…',
    folderName: 'インポート {date}',
    start: '{n} 件のブックマークをインポート',
    backingUp:
      '置き換える前に安全のためのバックアップを保存しています。続行するには保存ダイアログを確認してください。',
    keepTabOpen: 'インポートが完了するまでこのタブを開いたままにしてください。',
    progress: 'インポート中… {done} / {total}',
    doneSummary: '完了しました — {created} 件を作成しました。',
    skipped:
      'このブラウザに既にある {existing} 件と、ファイル内で重複する {inFile} 件をスキップしました。',
    cancelledSummary: 'キャンセルしました — 既に作成された {created} 件はそのまま残されています。',
    openEdit: '編集タブを開く',
    another: '別のファイルをインポート',
    dedupe: 'このブラウザに既にあるものをスキップする（{n} 件見つかりました）',
    dedupeDisabled: '対象外です。「すべて置き換える」は現在のブックマークを先に削除します。',
    replaceWarning:
      'この操作は現在のブックマークをすべて削除します。先に JSON のバックアップを保存し、それが成功するまで何も削除しません。',
    attest:
      'バックアップが保存されたことをブラウザが確認できませんでした。ダウンロードフォルダで {name} を確認してから続行してください。まだ何も削除されていません。',
    attestConfirm: 'バックアップを確認しました — 削除して置き換える',
    clearing: '現在のブックマークを削除しています。このタブを閉じないでください。',
    badgeNew: '新規',
    badgeDup: '重複',
    expand: 'フォルダを展開',
    collapse: 'フォルダを折りたたむ',
    stats: {
      bookmarks: 'ブックマーク',
      folders: 'フォルダ',
      depth: '最大の深さ',
      duplicates: '重複',
    },
    mode: {
      legend: 'どのように追加しますか？',
      newFolder: '新しいフォルダに入れる（推奨）',
      merge: '既存のフォルダに統合する',
      replace: 'すべて置き換える',
    },
    warnings: {
      title: '警告 {n} 件',
    },
  },
  warnings: {
    NO_BOOKMARKS: 'このファイルにブックマークは含まれていません。',
    DESCRIPTIONS_DROPPED:
      '説明 {n} 件を破棄しました。ブックマークのモデルに該当する項目がありません。',
    FAVICONS_IGNORED:
      'ファビコン {n} 件を無視しました。ブックマーク API はファビコンを設定できません。',
    INVALID_DATE: '読み取れない日付 {n} 件を空欄にしました。',
    MISSING_URL: 'アドレスのない項目 {n} 件をスキップしました。',
    NEWER_VERSION: 'このファイルは新しいバージョンで作成されています。可能な範囲で読み込みます。',
    EMPTY_TITLE: 'タイトルのないブックマークが {n} 件あり、代わりにアドレスを表示します。',
  },
  errors: {
    NOT_NETSCAPE: 'ブックマークの HTML ファイルではないようです。',
    NOT_BM_JSON: 'この JSON ファイルは BookmarkMagic が作成したものではありません。',
    MALFORMED_JSON: 'このファイルは有効な JSON ではありません。',
    INVALID_NODE: 'BookmarkMagic が読み取れない項目が含まれています。',
    BAD_CSV_HEADER: 'CSV のヘッダー行がないか、列の順序が正しくありません。',
    CSV_ROW_MISMATCH: 'CSV の行の列数が正しくありません。',
    UNKNOWN_FORMAT: 'ファイルを認識できません。ブックマークの HTML、JSON、CSV が必要です。',
    FILE_TOO_LARGE: 'このファイルは大きすぎてインポートできません。',
    TOO_MANY_NODES: 'このファイルには安全にインポートできる数を超えるブックマークがあります。',
    TOO_DEEP: 'このファイルはフォルダの入れ子が深すぎます。',
    BACKUP_SERIALIZE_FAILED: 'バックアップを準備できなかったため、何も変更していません。',
    BACKUP_CANCELLED: 'バックアップがキャンセルされたため、何も削除していません。',
    BACKUP_WRITE_FAILED: 'バックアップを保存できなかったため、何も削除していません。',
    BROWSER: 'ブラウザがブックマークの操作を拒否しました。',
    UNKNOWN: '問題が発生しました。',
  },
} satisfies Dict;
