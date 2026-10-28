import type { Dict } from './en';

/** Japanese strings for the Import tab — mirrors en-import.ts. */
export const importTab = {
  dropHint: 'ブックマークファイルをドロップするかクリックして選択してください・最大 {size}',
  dropFormats:
    'ブラウザの HTML エクスポート、CSV、BookmarkMagic と Firefox の JSON バックアップ、Chrome 自身の Bookmarks ファイル（拡張子なし）に対応しています。',
  reading: '{name} を読み込んでいます…',
  preview: 'プレビュー',
  folderName: 'インポート {date}',
  start: { one: '{n} 件のブックマークをインポート', other: '{n} 件のブックマークをインポート' },
  backingUp:
    '置き換える前に安全のためのバックアップを保存しています。続行するには保存ダイアログを確認してください。',
  keepTabOpen: 'インポートが完了するまでこのタブを開いたままにしてください。',
  progress: 'インポート中… {done} / {total}',
  doneSummary: '完了しました — {bookmarks}と{folders}を作成しました。',
  skipped:
    'このブラウザに既にある {existing} 件と、ファイル内で重複する {inFile} 件をスキップしました。',
  stepSource: 'ソース',
  stepOptions: 'オプション',
  stepWriting: '書き込み中',
  format: {
    'netscape-html': 'HTML',
    'bm-json': 'BookmarkMagic JSON',
    csv: 'CSV',
    'chrome-json': 'Chrome の Bookmarks ファイル',
    'firefox-json': 'Firefox のバックアップ',
  },
  countBookmarks: { one: 'ブックマーク {n} 件', other: 'ブックマーク {n} 件' },
  countFolders: { one: 'フォルダ {n} 件', other: 'フォルダ {n} 件' },
  countPair: '{bookmarks}と{folders}',
  whereNewFolder:
    'すべて「その他のブックマーク」内のフォルダ「{folder}」にあります。このフォルダを削除するとインポートを取り消せます。',
  whereMerge: '新しい項目は、それぞれのフォルダの末尾に追加されました。',
  whereReplace: 'ブックマークはファイルの内容とまったく同じになりました。',
  replaceConfirmTitle: 'すべて置き換えますか？',
  replaceConfirmBody:
    'バックアップを保存した後、このブラウザの{current}を削除し、{name} から{incoming}を書き込みます。',
  replaceConfirm: 'バックアップして置き換え',
  target: { bar: 'バー', unfiled: 'その他', mobile: 'モバイル' },
  targetNote:
    '統合と置き換えでは、このフォルダの中身はコピーを作らず、ブラウザの対応するフォルダに直接入ります。',
  reused: {
    one: 'コピーを作らずに、既存の {n} 個のフォルダに追加しました。',
    other: 'コピーを作らずに、既存の {n} 個のフォルダに追加しました。',
  },
  rootTitle: {
    toolbar: 'ブックマークツールバー',
    unfiled: '他のブックマーク',
    mobile: 'モバイルブックマーク',
  },
  cancelledSummary: {
    one: 'キャンセルしました — 既に作成された {n} 件はそのまま残されています。',
    other: 'キャンセルしました — 既に作成された {n} 件はそのまま残されています。',
  },
  cancelledAfterClear:
    '既存のブックマークが削除された後にキャンセルされたため、残っているのは再作成された分だけです。',
  dateNotice:
    'インポートしたブックマークの日付は本日になります。拡張機能がブックマークの元の作成日を設定することを Chrome が許可していないためです。エクスポートしたファイルには本来の日付が残ります。',
  partialCreated: {
    one: 'エラーの前に {n} 件が作成済みで、そのまま残されています。',
    other: 'エラーの前に {n} 件が作成済みで、そのまま残されています。',
  },
  partialCleared: {
    one: 'エラーの前に最上位の {n} 件が削除されています。バックアップから復元してください。',
    other: 'エラーの前に最上位の {n} 件が削除されています。バックアップから復元してください。',
  },
  backupFileType: 'ブックマークのバックアップ',
  backupHint:
    '安全のためのバックアップは {name} として保存されています。その JSON ファイルをインポートすると復元できます。',
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
    newFolderNote:
      '既存のものには触れません。気が変わったら日付付きのフォルダを 1 つ削除するだけです。',
    mergeNote: '既存のフォルダを再利用し、新しい項目はその末尾に追加します。',
    replaceNote: 'バックアップを保存してから、まずすべて削除します。バックアップの復元用です。',
  },
  warnings: {
    // 日本語は単複の区別がありませんが、docs/07 §5 に従い両方のキーを
    // 保持します（`satisfies Dict` の形状チェックを成立させるため）。
    title: { one: '警告 {n} 件', other: '警告 {n} 件' },
  },
} satisfies Dict['import'];
