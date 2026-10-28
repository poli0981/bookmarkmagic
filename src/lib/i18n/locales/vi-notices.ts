import type { Dict } from './en';

/** Vietnamese warnings and errors — mirrors en-notices.ts (docs/07 §2). */

export const warnings = {
  NO_BOOKMARKS: {
    one: 'Tệp này không chứa bookmark nào.',
    other: 'Tệp này không chứa bookmark nào.',
  },
  DESCRIPTIONS_DROPPED: {
    one: 'Đã bỏ {n} phần mô tả — mô hình bookmark không có chỗ cho chúng.',
    other: 'Đã bỏ {n} phần mô tả — mô hình bookmark không có chỗ cho chúng.',
  },
  FAVICONS_IGNORED: {
    one: 'Đã bỏ qua {n} favicon — API bookmark không thể đặt favicon.',
    other: 'Đã bỏ qua {n} favicon — API bookmark không thể đặt favicon.',
  },
  INVALID_DATE: {
    one: 'Đã để trống {n} ngày không đọc được.',
    other: 'Đã để trống {n} ngày không đọc được.',
  },
  MISSING_URL: {
    one: 'Đã bỏ qua {n} mục không có địa chỉ.',
    other: 'Đã bỏ qua {n} mục không có địa chỉ.',
  },
  NEWER_VERSION: {
    one: 'Tệp này được tạo bởi phiên bản mới hơn — đang đọc ở mức tốt nhất có thể.',
    other: 'Tệp này được tạo bởi phiên bản mới hơn — đang đọc ở mức tốt nhất có thể.',
  },
  EMPTY_TITLE: {
    one: '{n} bookmark không có tiêu đề — trình duyệt sẽ hiển thị địa chỉ thay thế.',
    other: '{n} bookmark không có tiêu đề — trình duyệt sẽ hiển thị địa chỉ thay thế.',
  },
  INVALID_URL: {
    one: '{n} mục có địa chỉ mà trình duyệt không lưu được nên đã bị bỏ qua.',
    other: '{n} mục có địa chỉ mà trình duyệt không lưu được nên đã bị bỏ qua.',
  },
  PLACE_QUERIES_SKIPPED: {
    one: 'Đã bỏ qua {n} bookmark thông minh của Firefox (một truy vấn đã lưu, không phải trang web) — ở đây nó sẽ là liên kết hỏng.',
    other:
      'Đã bỏ qua {n} bookmark thông minh của Firefox (truy vấn đã lưu, không phải trang web) — ở đây chúng sẽ là liên kết hỏng.',
  },
  EXTRA_ROOTS_SKIPPED: {
    one: '{n} bookmark nằm trong thư mục riêng của trình duyệt (như Speed Dial hay Thùng rác của Opera) nên không được nhập.',
    other:
      '{n} bookmark nằm trong thư mục riêng của trình duyệt (như Speed Dial hay Thùng rác của Opera) nên không được nhập.',
  },
  UNREADABLE_ENTRIES: {
    one: '{n} mục trong tệp không đọc được và đã bị bỏ qua.',
    other: '{n} mục trong tệp không đọc được và đã bị bỏ qua.',
  },
} satisfies Dict['warnings'];

export const errors = {
  NOT_NETSCAPE: 'Đây có vẻ không phải tệp HTML bookmark.',
  NOT_BM_JSON:
    'Tệp JSON này không phải tệp bookmark mà BookmarkMagic đọc được. Ứng dụng đọc bản sao lưu của chính nó, bản sao lưu JSON của Firefox và tệp Bookmarks của Chrome.',
  MALFORMED_JSON: 'Tệp này không phải JSON hợp lệ.',
  INVALID_NODE: 'Tệp này có một mục mà BookmarkMagic không đọc được.',
  BAD_CSV_HEADER: 'Thiếu dòng tiêu đề CSV hoặc các cột sai thứ tự.',
  CSV_ROW_MISMATCH: 'Một dòng CSV có số cột không đúng.',
  CSV_UNCLOSED_QUOTE:
    'Một trường CSV mở dấu ngoặc kép nhưng không đóng lại, nên phần còn lại của tệp không thể đọc chính xác.',
  UNKNOWN_FORMAT:
    'Không nhận diện được tệp — cần tệp HTML xuất bookmark, CSV, bản sao lưu JSON của BookmarkMagic hoặc Firefox, hoặc tệp Bookmarks của Chrome.',
  FILE_TOO_LARGE: 'Tệp này quá lớn để nhập.',
  TOO_MANY_NODES: 'Tệp này chứa quá nhiều bookmark để nhập an toàn.',
  TOO_DEEP: 'Tệp này lồng thư mục quá sâu.',
  BACKUP_SERIALIZE_FAILED: 'Không thể chuẩn bị bản sao lưu, nên không có gì bị thay đổi.',
  BACKUP_EXCEEDS_LIMITS:
    'Bookmark hiện tại của bạn nhiều hơn mức BookmarkMagic có thể đọc lại từ một bản sao lưu, nên thao tác Thay thế đã dừng trước khi xóa bất cứ thứ gì. Hãy dùng Gộp hoặc nhập vào thư mục mới.',
  BACKUP_CANCELLED: 'Bạn đã hủy bản sao lưu, nên không có gì bị xóa.',
  BACKUP_WRITE_FAILED: 'Không thể lưu bản sao lưu, nên không có gì bị xóa.',
  BROWSER: 'Trình duyệt đã từ chối một thao tác bookmark.',
  WRITE_LOCKED:
    'Một tab BookmarkMagic khác đang ghi bookmark. Hãy đợi nó xong rồi thử lại — chưa có gì bị thay đổi.',
  NO_WRITABLE_ROOTS:
    'Hồ sơ trình duyệt này không có thư mục bookmark nào mà BookmarkMagic được phép ghi vào. Bookmark do tổ chức quản lý thì không thể thay đổi.',
  PARTIAL_WRITE: 'Trình duyệt đã ngừng nhận bookmark khi quá trình nhập đang diễn ra.',
  PARTIAL_CLEAR: 'Trình duyệt đã dừng lại giữa chừng khi đang thay thế bookmark của bạn.',
  UNKNOWN: 'Đã xảy ra lỗi.',
} satisfies Dict['errors'];
