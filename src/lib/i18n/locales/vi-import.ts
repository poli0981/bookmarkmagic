import type { Dict } from './en';

/** Vietnamese strings for the Import tab — mirrors en-import.ts. */
export const importTab = {
  dropHint: 'Kéo thả tệp bookmark hoặc bấm để chọn · tối đa {size}',
  dropFormats:
    'Tệp HTML xuất từ trình duyệt, CSV, bản sao lưu JSON của BookmarkMagic và Firefox, và tệp Bookmarks của chính Chrome (tệp này không có phần mở rộng).',
  reading: 'Đang đọc {name}…',
  preview: 'Xem trước',
  folderName: 'Đã nhập {date}',
  start: { one: 'Nhập {n} bookmark', other: 'Nhập {n} bookmark' },
  backingUp:
    'Đang lưu bản sao lưu an toàn trước khi thay thế. Hãy xác nhận hộp thoại lưu để tiếp tục.',
  keepTabOpen: 'Giữ tab này mở cho đến khi nhập xong.',
  progress: 'Đang nhập… {done} / {total}',
  doneSummary: 'Hoàn tất — đã tạo {bookmarks} và {folders}.',
  skipped: 'Đã bỏ qua {existing} mục đã có trong trình duyệt và {inFile} mục lặp trong tệp.',
  stepSource: 'Nguồn',
  stepOptions: 'Tùy chọn',
  stepWriting: 'Đang ghi',
  format: {
    'netscape-html': 'HTML',
    'bm-json': 'JSON của BookmarkMagic',
    csv: 'CSV',
    'chrome-json': 'Tệp Bookmarks của Chrome',
    'firefox-json': 'Bản sao lưu Firefox',
  },
  countBookmarks: { one: '{n} bookmark', other: '{n} bookmark' },
  countFolders: { one: '{n} thư mục', other: '{n} thư mục' },
  countPair: '{bookmarks} và {folders}',
  whereNewFolder:
    'Mọi thứ nằm trong thư mục “{folder}” thuộc Dấu trang khác — xóa thư mục đó là hoàn tác lần nhập này.',
  whereMerge: 'Các mục mới được thêm vào cuối những thư mục chứa chúng.',
  whereReplace: 'Bookmark của bạn giờ chứa đúng những gì có trong tệp.',
  replaceConfirmTitle: 'Thay thế toàn bộ?',
  replaceConfirmBody:
    '{current} trong trình duyệt này sẽ bị xóa, sau khi bản sao lưu an toàn được lưu. Sau đó {incoming} từ {name} sẽ được ghi vào.',
  replaceConfirm: 'Sao lưu rồi thay thế',
  target: { bar: 'thanh dấu trang', unfiled: 'Khác', mobile: 'Di động' },
  targetNote:
    'Ở chế độ Gộp và Thay thế, nội dung thư mục này được đưa thẳng vào thư mục tương ứng của trình duyệt, không tạo bản sao của nó.',
  reused: {
    one: 'Đã thêm vào {n} thư mục bạn đã có, thay vì tạo bản sao.',
    other: 'Đã thêm vào {n} thư mục bạn đã có, thay vì tạo bản sao.',
  },
  rootTitle: {
    toolbar: 'Thanh dấu trang',
    unfiled: 'Dấu trang khác',
    mobile: 'Dấu trang di động',
  },
  cancelledSummary: {
    one: 'Đã hủy — {n} mục đã được tạo trước đó và vẫn được giữ lại.',
    other: 'Đã hủy — {n} mục đã được tạo trước đó và vẫn được giữ lại.',
  },
  cancelledAfterClear:
    'Bạn đã hủy sau khi bookmark cũ đã bị xóa, nên những gì còn lại chỉ là phần đã được tạo lại.',
  dateNotice:
    'Bookmark được nhập vào sẽ mang ngày hôm nay. Chrome không cho phép tiện ích đặt lại ngày tạo gốc của bookmark — các tệp bạn xuất ra vẫn giữ ngày thật.',
  partialCreated: {
    one: '{n} mục đã được tạo trước khi lỗi xảy ra và vẫn được giữ lại.',
    other: '{n} mục đã được tạo trước khi lỗi xảy ra và vẫn được giữ lại.',
  },
  partialCleared: {
    one: '{n} mục ở cấp cao nhất đã bị xóa trước khi lỗi xảy ra. Hãy khôi phục từ tệp sao lưu của bạn.',
    other:
      '{n} mục ở cấp cao nhất đã bị xóa trước khi lỗi xảy ra. Hãy khôi phục từ tệp sao lưu của bạn.',
  },
  backupHint: 'Tệp sao lưu an toàn đã được lưu với tên {name}. Nhập lại tệp JSON đó để khôi phục.',
  openEdit: 'Mở thẻ Chỉnh sửa',
  another: 'Nhập tệp khác',
  dedupe: 'Bỏ qua mục đã có trong trình duyệt này (tìm thấy {n})',
  dedupeDisabled: 'Không áp dụng: chế độ Thay thế sẽ xóa toàn bộ bookmark hiện tại trước.',
  replaceWarning:
    'Thao tác này xóa TOÀN BỘ bookmark hiện tại. Một bản sao lưu JSON sẽ được lưu trước, và sẽ không xóa gì cho đến khi việc đó thành công.',
  attest:
    'Trình duyệt không thể xác nhận bản sao lưu đã được lưu. Hãy kiểm tra thư mục tải xuống để tìm {name}, rồi xác nhận — hiện chưa có gì bị xóa.',
  attestConfirm: 'Tôi đã có bản sao lưu — xóa và thay thế',
  clearing: 'Đang xóa bookmark hiện tại. Đừng đóng tab này.',
  badgeNew: 'mới',
  badgeDup: 'trùng',
  expand: 'Mở thư mục',
  collapse: 'Thu gọn thư mục',
  stats: {
    bookmarks: 'Bookmark',
    folders: 'Thư mục',
    depth: 'Độ sâu tối đa',
    duplicates: 'Trùng lặp',
  },
  mode: {
    legend: 'Bạn muốn thêm như thế nào?',
    newFolder: 'Vào một thư mục mới (khuyên dùng)',
    merge: 'Gộp vào các thư mục hiện có',
    replace: 'Thay thế toàn bộ',
    newFolderNote: 'Không đụng tới gì có sẵn; chỉ một thư mục có ngày để xóa nếu bạn đổi ý.',
    mergeNote: 'Dùng lại các thư mục bạn đã có; mục mới được thêm vào cuối chúng.',
    replaceNote: 'Xóa toàn bộ trước, sau khi lưu bản sao lưu. Dùng để khôi phục bản sao lưu.',
  },
  warnings: {
    // Tiếng Việt chỉ có một dạng số, nhưng vẫn phải mang đủ hai khóa
    // (docs/07 §5) để phép kiểm tra `satisfies Dict` còn ý nghĩa.
    title: { one: '{n} cảnh báo', other: '{n} cảnh báo' },
  },
} satisfies Dict['import'];
