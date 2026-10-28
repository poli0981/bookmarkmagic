import type { Dict } from './en';
import { errors, warnings } from './ja-notices';

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
    dismiss: '閉じる',
    sections: 'セクション',
  },
  popup: {
    import: 'ブックマークをインポート…',
    export: 'ブックマークをエクスポート…',
    manage: 'マネージャーを開く',
    counts: 'ブックマーク {bookmarks} 件 · フォルダ {folders} 件',
  },
  import: {
    dropHint: 'ブックマークファイルをドロップするかクリックして選択してください · 最大 {size}',
    dropFormats:
      'ブラウザの HTML エクスポート、CSV、BookmarkMagic と Firefox の JSON バックアップ、Chrome 自身の Bookmarks ファイル（拡張子なし）に対応しています。',
    reading: '{name} を読み込んでいます…',
    preview: 'プレビュー',
    folderName: 'インポート {date}',
    start: '{n} 件のブックマークをインポート',
    backingUp:
      '置き換える前に安全のためのバックアップを保存しています。続行するには保存ダイアログを確認してください。',
    keepTabOpen: 'インポートが完了するまでこのタブを開いたままにしてください。',
    progress: 'インポート中… {done} / {total}',
    doneSummary: '完了しました — {created} 件を作成しました。',
    skipped:
      'このブラウザに既にある {existing} 件と、ファイル内で重複する {inFile} 件をスキップしました。',
    reused: {
      one: 'コピーを作らずに、既存の {n} 個のフォルダに追加しました。',
      other: 'コピーを作らずに、既存の {n} 個のフォルダに追加しました。',
    },
    rootTitle: {
      toolbar: 'ブックマークツールバー',
      unfiled: '他のブックマーク',
      mobile: 'モバイルブックマーク',
    },
    cancelledSummary: 'キャンセルしました — 既に作成された {created} 件はそのまま残されています。',
    cancelledAfterClear:
      '既存のブックマークが削除された後にキャンセルされたため、残っているのは再作成された分だけです。',
    dateNotice:
      'インポートしたブックマークの日付は本日になります。拡張機能がブックマークの元の作成日を設定することを Chrome が許可していないためです。エクスポートしたファイルには本来の日付が残ります。',
    partialCreated: 'エラーが発生する前に作成された {created} 件はそのまま残されています。',
    partialCleared:
      'エラーが発生する前に、最上位の {removed} 件が既に削除されています。バックアップから復元してください。',
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
    },
    warnings: {
      // 日本語は単複の区別がありませんが、docs/07 §5 に従い両方のキーを
      // 保持します（`satisfies Dict` の形状チェックを成立させるため）。
      title: { one: '警告 {n} 件', other: '警告 {n} 件' },
    },
  },
  export: {
    scope: 'エクスポートする範囲',
    everything: 'すべて',
    format: '形式',
    start: '{n} 件のブックマークをエクスポート',
    saved: '{name} を保存しました',
    markdownNote: 'Markdown は共有専用です。BookmarkMagic では読み込めません。',
    csvNote: 'CSV は平坦化された形式です。空のフォルダやブックマークバーの区別は保持されません。',
    csvDelimiter: '区切り文字',
    comma: 'カンマ ( , )',
    semicolon: 'セミコロン ( ; )',
    markdownStyle: 'レイアウト',
    nested: '入れ子のリスト',
    flat: 'フォルダごとの見出し',
    formats: {
      'netscape-html': {
        name: 'HTML',
        note: 'Chrome、Edge、Brave、Firefox、Safari、Vivaldi、Opera で利用できます。',
      },
      'bm-json': { name: 'JSON', note: '欠落のないバックアップ。復元にはこれが最適です。' },
      csv: { name: 'CSV', note: '表計算ソフト向け。平坦化されます。' },
      markdown: { name: 'Markdown', note: 'README、ブログ、チャットでの共有向け。' },
    },
  },
  edit: {
    tree: 'ブックマークのツリー',
    loading: 'ブックマークを読み込んでいます…',
    search: 'ブックマークを検索',
    newFolder: '新しいフォルダ',
    newFolderTitle: '新しいフォルダ',
    findDuplicates: '重複を探す',
    expandAll: 'すべて展開',
    collapseAll: 'すべて折りたたむ',
    rename: '名前を変更',
    open: '開く',
    copyUrl: 'リンクをコピー',
    unsafeUrl: 'このアドレスは BookmarkMagic が開かない形式です。',
    copied: 'リンクをコピーしました',
    copyFailed: 'リンクをコピーできませんでした。',
    moveTo: '移動…',
    moveToBody: '「{title}」をどのフォルダへ移動しますか？',
    noMoveTargets: '他に利用できるフォルダがありません。',
    delete: '削除',
    untitled: '（無題）',
    empty: 'ブックマークがありません。インポートして始めてください。',
    noMatches: '一致するものがありません。',
    showMore: 'さらに {n} 行を表示・未表示 {total} 行',
    deleteTitle: 'この項目を削除しますか？',
    deleteBody: '「{title}」を削除しますか？元に戻せません。',
    deleteFolderBody: {
      one: '「{title}」と、その中の {n} 件を削除しますか？元に戻せません。',
      other: '「{title}」と、その中の {n} 件を削除しますか？元に戻せません。',
    },
    duplicates: '重複',
    duplicatesFound: '重複リンク {groups} 件・余分なコピー {extra} 件',
    noDuplicates: '重複するリンクは見つかりませんでした。',
    keepFirst: {
      one: '各グループの最初を残し、{n} 件を削除',
      other: '各グループの最初を残し、{n} 件を削除',
    },
    keeps: '保持',
    deleteCopy: '{path} にあるコピー「{title}」を削除',
    keepFirstTitle: '重複したコピーを削除しますか？',
    keepFirstBody: {
      one: '各リンクの最初のコピーを残し、他の {n} 件を削除しますか？元に戻せません。',
      other: '各リンクの最初のコピーを残し、他の {n} 件を削除しますか？元に戻せません。',
    },
    keepFirstPartial:
      'エラーが発生する前に {total} 件中 {done} 件を削除しました。それ以外は削除されていません。',
    sort: 'A→Z で並べ替え',
    sortTitle: '「{title}」を並べ替えますか？',
    sortBody: {
      one: 'フォルダを先に、次にブックマークを名前順に並べます。{n} 件が移動します。名前の変更や削除はなく、ブラウザではこの操作を元に戻せません。',
      other:
        'フォルダを先に、次にブックマークを名前順に並べます。{n} 件が移動します。名前の変更や削除はなく、ブラウザではこの操作を元に戻せません。',
    },
    sortPartial:
      'ブラウザが拒否する前に {total} 件中 {done} 件を移動しました。フォルダは現在の実際の順序で表示されています。',
    alreadySorted: 'このフォルダはすでに並んでいます。',
  },
  settings: {
    autosave: '変更は自動的に保存されます。',
    language: '言語',
    languageNote: 'この拡張機能だけに適用され、ブラウザの言語は変わりません。',
    localeAuto: '自動（ブラウザに合わせる）',
    lang: {
      // 自称表記。三つの辞書で意図的に同一にしています。
      en: 'English',
      vi: 'Tiếng Việt',
      ja: '日本語',
    },
    theme: 'テーマ',
    themes: {
      system: 'システム',
      light: 'ライト',
      dark: 'ダーク',
    },
    defaultExportFormat: '既定のエクスポート形式',
    defaultExportFormatNote: 'エクスポートタブを開いたときに選択されます。',
    defaultImportMode: '既定のインポート方法',
    defaultImportModeNote: 'インポートタブを開いたときに選択されます。',
    csvDelimiter: 'CSV の区切り文字',
    csvDelimiterNote: '表計算ソフトが必要とする場合はセミコロンを選んでください。',
    markdownStyle: 'Markdown のレイアウト',
    markdownStyleNote: 'エクスポートした Markdown でフォルダを並べる方法です。',
    saved: '設定を保存しました',
    saveFailed: '設定を保存できませんでした。',
    reset: '既定値に戻す',
    resetTitle: 'すべての設定を戻しますか？',
    resetBody:
      '言語・テーマ・すべての既定の選択が初期状態に戻ります。ブックマークには影響しません。',
    resetConfirm: '戻す',
    resetDone: '設定を既定値に戻しました',
  },
  about: {
    tagline:
      'ブラウザ間でブックマークをインポート・エクスポート・編集 — オフライン、アカウント不要、クラウド不要。データが端末から出ることはありません。',
    version: 'バージョン {version}',
    links: 'リンク',
    repo: 'GitHub リポジトリ',
    issues: '問題を報告',
    changelog: 'リリースと変更履歴',
    store: 'Chrome ウェブストアのページ',
    thirdParty: 'サードパーティ依存: なし',
    thirdPartyNote: 'BookmarkMagic は実行時ライブラリを一切同梱していません。',
    donate: '開発を支援する',
    donateNote: '完全に任意です — BookmarkMagic はどちらにせよ自由ソフトウェアです。',
    legal: '法的事項',
    accepted: '{date} に規約に同意済み · バージョン {version}',
    acceptedUndated: '規約に同意済み · バージョン {version}',
    notAccepted: 'まだ法的規約に同意していません。',
  },
  legal: {
    title: 'ご利用の前に',
    summary:
      'BookmarkMagic は完全にお使いの端末上で動作します。サーバーを持たず、ネットワーク通信を行わず、何も収集しません — ブックマークと設定がこのブラウザから出ることはありません。GPL-3.0 ライセンスの自由ソフトウェアであり、いかなる保証もありません。ブックマーク操作はブラウザのデータを変更し、「すべて置き換える」方法では現在のブックマークが削除されますので、大切なものはご自身でバックアップを保管してください。',
    updatedTitle: '規約が更新されました',
    updatedBody:
      'ご同意いただいた後にこれらの文書が変更されました。続けるにはもう一度お読みください。',
    documents: '文書',
    eula: 'エンドユーザーライセンス契約',
    license: 'ライセンス（GPL-3.0）',
    disclaimer: '免責事項',
    privacy: 'プライバシーポリシー',
    englishNote: '法的効力を持つ文書は英語で書かれています。',
    accept: '上記の規約を読み、同意します',
    continue: '同意して続ける',
    close: 'タブを閉じる',
    closeManually: 'このタブを閉じていただいて構いません。',
    saveFailed:
      '同意を保存できなかったため、何も記録されていません。このブラウザで拡張機能のストレージが許可されているか確認してから、もう一度お試しください。',
    blocked: 'インポート・エクスポート・編集タブを使うには規約に同意してください。',
  },
  warnings,
  errors,
} satisfies Dict;
