import type { Dict } from './en';

/** Simplified Chinese warnings and errors — mirrors en-notices.ts (docs/07 §2). */

export const warnings = {
  NO_BOOKMARKS: {
    one: '此文件不包含任何书签。',
    other: '此文件不包含任何书签。',
  },
  DESCRIPTIONS_DROPPED: {
    one: '已丢弃 {n} 条描述——书签模型中没有存放描述的位置。',
    other: '已丢弃 {n} 条描述——书签模型中没有存放描述的位置。',
  },
  FAVICONS_IGNORED: {
    one: '已忽略 {n} 个网站图标——书签 API 无法设置网站图标。',
    other: '已忽略 {n} 个网站图标——书签 API 无法设置网站图标。',
  },
  INVALID_DATE: {
    one: '{n} 个无法识别的日期已留空。',
    other: '{n} 个无法识别的日期已留空。',
  },
  MISSING_URL: {
    one: '{n} 个条目没有地址，已跳过。',
    other: '{n} 个条目没有地址，已跳过。',
  },
  NEWER_VERSION: {
    one: '此文件由较新的版本写入——将尽可能读取。',
    other: '此文件由较新的版本写入——将尽可能读取。',
  },
  EMPTY_TITLE: {
    one: '{n} 个书签没有标题——浏览器会改为显示其地址。',
    other: '{n} 个书签没有标题——浏览器会改为显示其地址。',
  },
  INVALID_URL: {
    one: '{n} 个条目的地址无法存入浏览器，因此已跳过。',
    other: '{n} 个条目的地址无法存入浏览器，因此已跳过。',
  },
  PLACE_QUERIES_SKIPPED: {
    one: '已跳过 {n} 个 Firefox 智能书签（已保存的搜索，而非网页）——在这里它会成为失效链接。',
    other: '已跳过 {n} 个 Firefox 智能书签（已保存的搜索，而非网页）——在这里它们会成为失效链接。',
  },
  EXTRA_ROOTS_SKIPPED: {
    one: '浏览器专用文件夹（例如 Opera 的快速拨号或回收站）中的 {n} 个书签未导入。',
    other: '浏览器专用文件夹（例如 Opera 的快速拨号或回收站）中的 {n} 个书签未导入。',
  },
  UNREADABLE_ENTRIES: {
    one: '此文件中有 {n} 个条目无法读取，已跳过。',
    other: '此文件中有 {n} 个条目无法读取，已跳过。',
  },
} satisfies Dict['warnings'];

export const errors = {
  NOT_NETSCAPE: '这似乎不是书签 HTML 文件。',
  NOT_BM_JSON:
    '此 JSON 文件不是 BookmarkMagic 能读取的书签文件。它可以读取自己的备份、Firefox 的 JSON 备份和 Chrome 的 Bookmarks 文件。',
  MALFORMED_JSON: '此文件不是有效的 JSON。',
  INVALID_NODE: '此文件中有 BookmarkMagic 无法读取的条目。',
  BAD_CSV_HEADER: 'CSV 标题行缺失，或其中各列的顺序不正确。',
  CSV_ROW_MISMATCH: '某一 CSV 行的列数不正确。',
  CSV_UNCLOSED_QUOTE: '某个带引号的 CSV 字段始终没有闭合，因此无法可靠地读取文件的其余部分。',
  UNKNOWN_FORMAT:
    '无法识别此文件——应为浏览器导出的书签 HTML、CSV、BookmarkMagic 或 Firefox 的 JSON 备份，或 Chrome 的 Bookmarks 文件。',
  FILE_TOO_LARGE: '此文件太大，无法导入。',
  TOO_MANY_NODES: '此文件包含的书签过多，无法安全导入。',
  TOO_DEEP: '此文件中的文件夹嵌套层级过深。',
  BACKUP_SERIALIZE_FAILED: '无法准备安全备份，因此未做任何更改。',
  BACKUP_EXCEEDS_LIMITS:
    '您当前的书签超出了 BookmarkMagic 能从备份中读回的范围，因此“替换”在删除任何内容之前就已停止。请改为合并，或导入到新文件夹。',
  BACKUP_STALE:
    '保存安全备份期间，您的书签一直在变化（另一个窗口、标签页或同步正在编辑它们），因此未删除任何内容。请稍后重试。',
  BACKUP_CANCELLED: '您取消了安全备份，因此未删除任何内容。',
  BACKUP_WRITE_FAILED: '无法保存安全备份，因此未删除任何内容。',
  BROWSER: '浏览器拒绝了一项书签操作。',
  WRITE_LOCKED: '另一个 BookmarkMagic 标签页正在写入书签。请等待其完成后重试——未做任何更改。',
  NO_WRITABLE_ROOTS:
    '此浏览器个人资料中没有 BookmarkMagic 有权写入的书签文件夹。由组织管理的书签无法更改。',
  PARTIAL_WRITE: '导入进行到一半时，浏览器停止接受书签。',
  PARTIAL_CLEAR: '替换您的书签进行到一半时，浏览器停止了操作。',
  UNKNOWN: '出了点问题。',
} satisfies Dict['errors'];
