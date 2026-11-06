import type { Dict } from './en';

/** Simplified Chinese strings for the Import tab — mirrors en-import.ts. */
export const importTab = {
  dropHint: '将书签文件拖放到此处，或点击浏览 · 最大 {size}',
  dropFormats:
    '支持浏览器导出的 HTML、CSV、BookmarkMagic 和 Firefox 的 JSON 备份，以及 Chrome 自带的 Bookmarks 文件（该文件没有扩展名）。',
  reading: '正在读取 {name}…',
  preview: '预览',
  folderName: '已导入 {date}',
  start: { one: '导入 {n} 个书签', other: '导入 {n} 个书签' },
  backingUp: '替换前正在保存安全备份。请在保存对话框中确认以继续。',
  keepTabOpen: '导入完成前，请勿关闭此标签页。',
  progress: '正在导入… {done} / {total}',
  doneSummary: '完成——已创建 {bookmarks}和 {folders}。',
  skipped: '已跳过此浏览器中已有的 {existing} 项，以及文件中重复的 {inFile} 项。',
  stepSource: '来源',
  stepOptions: '选项',
  stepWriting: '写入',
  stepResult: '结果',
  format: {
    'netscape-html': 'HTML',
    'bm-json': 'BookmarkMagic JSON',
    csv: 'CSV',
    'chrome-json': 'Chrome Bookmarks 文件',
    'firefox-json': 'Firefox 备份',
  },
  countBookmarks: { one: '{n} 个书签', other: '{n} 个书签' },
  countFolders: { one: '{n} 个文件夹', other: '{n} 个文件夹' },
  countPair: '{bookmarks}和 {folders}',
  whereNewFolder:
    '所有内容都在“其他书签”下的“{folder}”文件夹中——删除这一个文件夹即可撤销本次导入。',
  whereMerge: '新项目已添加到各自所属文件夹的末尾。',
  whereReplace: '书签现在与文件中的内容完全一致。',
  replaceConfirmTitle: '要全部替换吗？',
  replaceConfirmBody:
    '保存安全备份后，将删除此浏览器中的 {current}。然后写入 {name} 中的 {incoming}。',
  replaceConfirm: '备份并替换',
  target: { bar: '书签栏', unfiled: '其他书签', mobile: '移动设备书签' },
  targetNote:
    '在合并和替换模式下，此文件夹中的内容会直接放入对应的浏览器文件夹，而不是创建它的副本。',
  reused: {
    one: '已添加到您原有的 {n} 个文件夹中，没有创建副本。',
    other: '已添加到您原有的 {n} 个文件夹中，没有创建副本。',
  },
  // Firefox's own zh-CN names for its roots. TODO(review-zh): confirm 移动设备上的书签.
  rootTitle: {
    toolbar: '书签工具栏',
    unfiled: '其他书签',
    mobile: '移动设备上的书签',
  },
  cancelledSummary: {
    one: '已取消——已创建的 {n} 项保持原样。',
    other: '已取消——已创建的 {n} 项保持原样。',
  },
  cancelledAfterClear: '您是在现有书签已被删除之后取消的，因此剩下的只有已重建的部分。',
  dateNotice:
    '导入的书签日期均为今天。Chrome 不允许扩展程序设置书签的原始日期——您导出的文件会保留真实日期。',
  partialCreated: {
    one: '操作失败前已创建 {n} 项，这些项保持原样。',
    other: '操作失败前已创建 {n} 项，这些项保持原样。',
  },
  partialCleared: {
    one: '操作失败前已删除 {n} 个顶层项目。请从备份中恢复。',
    other: '操作失败前已删除 {n} 个顶层项目。请从备份中恢复。',
  },
  backupFileType: '书签备份',
  backupHint: '您的安全备份已保存为 {name}。导入该 JSON 文件即可恢复。',
  openEdit: '打开“编辑”标签页',
  another: '导入其他文件',
  dedupe: '跳过此浏览器中已有的重复项（找到 {n} 个）',
  dedupeDisabled: '不适用：“全部替换”会先删除您当前的书签。',
  replaceWarning:
    '此操作会删除当前的全部书签。会先保存一份 JSON 安全备份，备份成功之前不会删除任何内容。',
  attest:
    '您的浏览器无法确认备份已保存。请在下载文件夹中查找 {name}，然后确认——目前尚未删除任何内容。',
  attestConfirm: '我已有备份——删除并替换',
  clearing: '正在删除当前的书签。请勿关闭此标签页。',
  badgeNew: '新',
  badgeDup: '重复',
  expand: '展开文件夹',
  collapse: '折叠文件夹',
  stats: {
    bookmarks: '书签',
    folders: '文件夹',
    depth: '最大深度',
    duplicates: '重复项',
  },
  mode: {
    legend: '要如何添加这些内容？',
    newFolder: '放入新文件夹（推荐）',
    merge: '合并到现有文件夹',
    replace: '全部替换',
    newFolderNote: '不会改动任何现有内容；如果改变主意，只需删除一个带日期的文件夹。',
    mergeNote: '沿用您已有的文件夹；新项目添加到这些文件夹的末尾。',
    replaceNote: '先保存备份，再删除所有内容。用于恢复备份。',
  },
  warnings: {
    title: { one: '{n} 条警告', other: '{n} 条警告' },
  },
} satisfies Dict['import'];
