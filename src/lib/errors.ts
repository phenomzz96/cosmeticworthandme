/**
 * Chuyển lỗi từ Supabase / database thành thông báo tiếng Việt dễ hiểu.
 * Không hiển thị chi tiết kỹ thuật nhạy cảm cho người dùng.
 */
interface ErrorLike {
  message?: string
  code?: string
  status?: number
}

/** Lỗi trùng dữ liệu: nhận diện theo tên ràng buộc trong database */
const uniqueMessages: Record<string, string> = {
  shops_name_unique: 'Tên cửa hàng này đã có người dùng. Hãy chọn tên khác.',
  shops_slug_key: 'Đường dẫn cửa hàng đã có người dùng. Hãy chọn đường dẫn khác.',
  shops_owner_id_key: 'Bạn đã có cửa hàng. Mỗi tài khoản chỉ mở 1 cửa hàng.',
  products_slug_key: 'Đường dẫn sản phẩm bị trùng. Hãy thử lưu lại.',
  products_shop_sku_unique: 'Mã SKU này đã dùng cho sản phẩm khác trong cửa hàng.',
}

const rules: { test: (e: ErrorLike) => boolean; message: string }[] = [
  { test: (e) => /invalid login credentials/i.test(e.message ?? ''), message: 'Email hoặc mật khẩu không đúng.' },
  {
    test: (e) => /email not confirmed/i.test(e.message ?? ''),
    message: 'Email chưa được xác minh. Hãy mở email xác nhận đã gửi tới hộp thư của bạn.',
  },
  { test: (e) => /already registered|already been registered/i.test(e.message ?? ''), message: 'Email này đã được đăng ký.' },
  {
    test: (e) => /password should be|password is too short|weak password/i.test(e.message ?? ''),
    message: 'Mật khẩu chưa đủ mạnh. Dùng ít nhất 8 ký tự, gồm cả chữ và số.',
  },
  {
    test: (e) => /email address not authorized/i.test(e.message ?? ''),
    message: 'Hệ thống email đang ở chế độ thử nghiệm và chỉ gửi được tới thành viên nhóm phát triển.',
  },
  {
    test: (e) => e.status === 429 || /rate limit|too many requests|security purposes/i.test(e.message ?? ''),
    message: 'Bạn thao tác quá nhanh hoặc đã vượt giới hạn gửi email. Vui lòng thử lại sau ít phút.',
  },
  { test: (e) => /same.*password|different from the old/i.test(e.message ?? ''), message: 'Mật khẩu mới phải khác mật khẩu cũ.' },
  { test: (e) => e.code === '42501', message: 'Bạn không có quyền thực hiện thao tác này.' },
  { test: (e) => e.code === '23514' || e.code === '22P02', message: 'Dữ liệu không hợp lệ. Kiểm tra lại thông tin đã nhập.' },
  { test: (e) => e.code === 'PGRST116', message: 'Không tìm thấy dữ liệu, hoặc tài khoản của bạn không được phép thay đổi.' },
  {
    test: (e) => /failed to fetch|network|load failed/i.test(e.message ?? ''),
    message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  },
  { test: (e) => /payload too large|exceeded the maximum allowed size/i.test(e.message ?? ''), message: 'Tệp quá lớn.' },
  { test: (e) => /mime type|invalid_mime/i.test(e.message ?? ''), message: 'Định dạng tệp không được hỗ trợ.' },
]

export function friendlyError(err: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  if (!err) return fallback
  const e: ErrorLike = typeof err === 'object' ? (err as ErrorLike) : { message: String(err) }
  // Thông báo do chính hệ thống viết bằng tiếng Việt (hàm SQL, trigger, service) thì giữ nguyên: cụ thể hơn
  if (e.message && /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(e.message)) return e.message
  if (e.code === '23505') {
    const key = Object.keys(uniqueMessages).find((k) => e.message?.includes(k))
    return key ? uniqueMessages[key] : 'Dữ liệu bị trùng với một mục đã có.'
  }
  const hit = rules.find((r) => r.test(e))
  if (hit) return hit.message
  return fallback
}
