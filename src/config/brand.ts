/**
 * ============================================================================
 *  CẤU HÌNH THƯƠNG HIỆU & NHÓM — sửa ở đây, toàn bộ website cập nhật theo
 *  (header, footer, trang đăng nhập, trang chủ, tiêu đề tab trình duyệt...).
 * ============================================================================
 *
 *  TỪ GIAI ĐOẠN 1A: tên thương hiệu, logo, favicon và màu chủ đạo do Admin chỉnh tại
 *  trang /admin/brand và được lưu trên Supabase (bảng site_settings + Storage),
 *  nên MỌI thiết bị thấy giống nhau. Các giá trị trong file này chỉ là MẶC ĐỊNH,
 *  dùng khi chưa kết nối Supabase hoặc chưa tải xong cài đặt.
 *
 *  Giá trị `null` = nhóm CHƯA cung cấp. Website sẽ tự dùng bản dự phòng:
 *   - logo null    -> logo chữ tự sinh từ `brand.name`, tự đổi màu theo theme
 *   - slogan null  -> không hiển thị slogan
 *   - team.name null -> hiển thị nhãn "Tên nhóm: chưa cập nhật" ở footer
 *
 *  ĐỔI LOGO (không cần sửa file code nào khác):
 *   1. Chép file vào public/brand/, ví dụ public/brand/logo.png
 *   2. Đặt  logo.light = '/brand/logo.png'
 *   3. Nếu có bản cho nền tối: logo.dark = '/brand/logo-dark.png'
 *      Nếu chỉ có 1 bản và bị chìm trên nền tối: để dark = null, bật darkBackdrop
 *   4. Đặt aspectRatio = chiều rộng / chiều cao của file (ví dụ 600x150 -> 4)
 *      để logo không bị méo.
 *
 *  Màu sắc & font chữ thương hiệu: src/styles/tokens.css
 */

export const brand = {
  /** Tên thương hiệu mặc định (Admin đổi được trên website) */
  name: 'Worth & Me',
  /** Tên rút gọn cho chỗ hẹp (mobile, favicon) */
  shortName: 'W&M',
  /** Mô tả ngắn, dùng cho thẻ meta và chân trang. Đây là mô tả, không phải slogan. */
  description: 'Sàn mỹ phẩm và chăm sóc sắc đẹp nhiều cửa hàng.',
  /** Slogan chính thức — CHƯA CÓ, chờ nhóm cung cấp */
  slogan: null as string | null,

  logo: {
    /** Logo dùng trên nền sáng (đường dẫn trong public/), null = dùng logo dự phòng */
    light: null as string | null,
    /** Logo dùng trên nền tối, null = dùng lại bản light */
    dark: null as string | null,
    /** Tỷ lệ rộng/cao của file logo thật */
    aspectRatio: 4,
    /** Khi chỉ có 1 bản logo màu tối: thêm nền sáng phía sau ở dark mode để không bị chìm */
    darkBackdrop: true,
    alt: 'Worth & Me',
  },

  /** Favicon trong public/. Bản hiện tại là chữ cái dự phòng. */
  favicon: '/brand/favicon.svg',

  /** Màu chủ đạo mặc định (khớp giá trị mặc định trong database) */
  primaryColor: '#79628e',

  contact: {
    email: null as string | null,
    hotline: null as string | null,
  },
} as const

/** Thông tin NHÓM THỰC HIỆN dự án — tách riêng, KHÔNG dùng tên thương hiệu thay thế */
export const team = {
  /** Tên nhóm — CHƯA CÓ, chờ nhóm cung cấp */
  name: null as string | null,
  /** Môn học / mục đích dự án */
  course: 'Nhập môn Công nghệ thông tin',
  /** Danh sách thành viên, ví dụ ['Nguyễn Văn A', 'Trần Thị B'] */
  members: [] as string[],
}

export const PLACEHOLDER = {
  teamName: 'Tên nhóm: chưa cập nhật',
} as const

/** Năm hiện tại cho dòng bản quyền */
export const copyrightYear = new Date().getFullYear()

/** Thông tin còn thiếu trong file này — in nhắc nhở khi chạy dev. Logo quản lý tại /admin/brand. */
export function missingBrandAssets(): string[] {
  const missing: string[] = []
  if (!brand.slogan) missing.push('slogan (brand.slogan)')
  if (!team.name) missing.push('tên nhóm (team.name)')
  return missing
}
