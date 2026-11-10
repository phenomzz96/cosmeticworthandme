/**
 * NỘI DUNG MẶC ĐỊNH của các trang thông tin.
 * Admin sửa nội dung tại /admin/pages; khi Admin chưa sửa (hoặc bấm "Khôi phục mặc định"), website dùng nội dung dưới đây.
 *
 * Cú pháp (giống Markdown rút gọn):
 *   ## Tiêu đề mục          → tiêu đề (ở trang Câu hỏi thường gặp: mỗi "##" là một câu hỏi)
 *   - Gạch đầu dòng          → danh sách
 *   **chữ đậm**              → chữ đậm
 *   [chữ](/duong-dan)        → liên kết (trong website: bắt đầu bằng /, bên ngoài: https://..., email: mailto:...)
 *   {{ten_san}}              → tên thương hiệu hiện tại
 *   {{phi_van_chuyen}}       → phí vận chuyển hiện tại (Admin chỉnh ở /admin/brand)
 */

export type PageSlug = 'about' | 'contact' | 'faq' | 'policies' | 'terms' | 'announcement' | 'footer'

export interface PageContent {
  title: string
  intro: string
  body: string
}

export const PAGE_META: Record<PageSlug, { label: string; path: string | null; hint: string }> = {
  about: { label: 'Giới thiệu', path: '/about', hint: 'Trang /about' },
  contact: { label: 'Liên hệ', path: '/contact', hint: 'Trang /contact. Khung gửi tin nhắn cho bộ phận hỗ trợ luôn hiện bên dưới nội dung.' },
  faq: { label: 'Câu hỏi thường gặp', path: '/faq', hint: 'Mỗi dòng "## ..." là một câu hỏi, các dòng bên dưới là câu trả lời.' },
  policies: { label: 'Chính sách', path: '/policies', hint: 'Mỗi dòng "## ..." là một mục, tự hiện trong mục lục đầu trang.' },
  terms: { label: 'Điều khoản sử dụng', path: '/terms', hint: 'Trang /terms' },
  announcement: { label: 'Thanh thông báo', path: null, hint: 'Một dòng ngắn trên cùng mọi trang (tối đa 200 ký tự). Để trống để ẩn.' },
  footer: { label: 'Mô tả chân trang', path: null, hint: 'Đoạn ngắn dưới logo ở chân trang (tối đa 300 ký tự). Để trống để ẩn.' },
}

export const DEFAULT_PAGES: Record<PageSlug, PageContent> = {
  announcement: {
    title: '',
    intro: '',
    body: 'Thanh toán khi nhận hàng (COD) · Lưu mã giảm giá trong Ví voucher để dùng khi đặt hàng',
  },

  footer: { title: '', intro: '', body: '' },

  about: {
    title: 'Giới thiệu',
    intro: '{{ten_san}} là sàn mỹ phẩm nhiều cửa hàng: mỗi cửa hàng tự đăng bán, sàn giúp bạn tìm đúng sản phẩm và đặt hàng ở một nơi.',
    body: `## Chúng tôi làm gì
- Gom skincare, makeup, haircare, body care, nước hoa, sản phẩm cho nam giới và dụng cụ làm đẹp từ nhiều cửa hàng về một nơi; tìm kiếm không cần gõ dấu.
- [Beauty Finder](/beauty-finder) gợi ý sản phẩm theo nhu cầu, loại da, ngân sách và mùi hương bạn thích, kèm lý do vì sao sản phẩm phù hợp. Gợi ý dựa trên thông tin sản phẩm, không thay thế tư vấn của bác sĩ da liễu.
- Đánh giá chỉ đến từ khách đã mua và đã nhận hàng, nên điểm số phản ánh trải nghiệm thật.

## Cách sàn hoạt động
- Người bán đăng ký mở cửa hàng; quản trị viên duyệt trước khi cửa hàng được bán.
- Một đơn hàng có sản phẩm của nhiều cửa hàng được tách thành đơn con cho từng cửa hàng; mỗi cửa hàng tự xác nhận và giao phần của mình.
- Giá, phí vận chuyển, mã giảm giá và tồn kho được máy chủ kiểm tra lại khi đặt hàng.
- Bạn nhắn tin trực tiếp cho cửa hàng hoặc bộ phận hỗ trợ của sàn ngay trên website.
- Quản trị viên kiểm duyệt cửa hàng, sản phẩm và đánh giá vi phạm; mọi thao tác quản trị đều được ghi nhật ký.

## Bắt đầu
- [Xem tất cả sản phẩm](/products)
- [Mở cửa hàng trên {{ten_san}}](/seller)`,
  },

  contact: {
    title: 'Liên hệ',
    intro: 'Chọn đúng nơi liên hệ để được trả lời nhanh nhất.',
    body: `## Về một đơn hàng hoặc sản phẩm
Bấm **Nhắn tin cho shop** trên trang sản phẩm hoặc trang cửa hàng để hỏi trực tiếp người bán. Tiến trình đơn xem ở [Đơn hàng của tôi](/orders).

## Khiếu nại, báo cáo vi phạm, góp ý cho sàn
Gửi tin nhắn cho bộ phận hỗ trợ bằng khung bên dưới (cần đăng nhập). Ghi rõ mã đơn hàng (dạng WM…) hoặc đường dẫn sản phẩm, cửa hàng.

Không gửi mật khẩu, mã xác minh hay thông tin thẻ ngân hàng qua bất kỳ kênh liên hệ nào.

## Muốn bán hàng trên sàn
Đăng nhập rồi vào [Kênh người bán](/seller) để đăng ký cửa hàng. Quản trị viên sẽ duyệt hoặc phản hồi lý do nếu cần bổ sung thông tin.`,
  },

  faq: {
    title: 'Câu hỏi thường gặp',
    intro: 'Những thắc mắc hay gặp khi mua sắm trên {{ten_san}}.',
    body: `## Tôi có cần tài khoản để mua hàng không?
Bạn xem sản phẩm và thêm vào giỏ mà không cần đăng nhập. Khi đặt hàng cần đăng nhập để lưu địa chỉ và theo dõi đơn; giỏ hàng trên trình duyệt sẽ được gộp vào tài khoản.

## Vì sao đơn của tôi bị tách thành nhiều đơn con?
Mỗi cửa hàng tự đóng gói và giao phần sản phẩm của mình, nên đơn có sản phẩm từ 2 cửa hàng sẽ có 2 đơn con, mỗi đơn con có phí vận chuyển và tiến trình riêng.

## Phí vận chuyển là bao nhiêu?
Phí vận chuyển hiện tại: **{{phi_van_chuyen}}** cho mỗi cửa hàng trong đơn. Số tiền chính xác hiện ở giỏ hàng và trang đặt hàng trước khi bạn xác nhận.

## Có những cách thanh toán nào?
Thanh toán khi nhận hàng (COD) và chuyển khoản bằng mã QR mô phỏng. Mã QR chỉ chứa mã đơn và số tiền, không gắn tài khoản ngân hàng. Website không thu thập số thẻ hay số tài khoản.

## Dùng mã giảm giá như thế nào?
Lưu mã ở trang cửa hàng hoặc [Ví voucher](/vouchers), rồi nhập mã ở giỏ hàng. Mỗi đơn dùng tối đa 1 mã của sàn và 1 mã cho mỗi cửa hàng. Số tiền giảm được tính lại khi đặt hàng.

## Tôi hủy đơn được không?
Được, khi đơn con còn ở trạng thái "Chờ xác nhận". Sau khi cửa hàng đã xác nhận, hãy nhắn tin cho cửa hàng. Đơn đã thanh toán mà bị hủy sẽ được đánh dấu chờ hoàn tiền.

## Đổi trả sản phẩm thế nào?
Mỗi cửa hàng công bố chính sách đổi trả riêng ở trang cửa hàng. Mỹ phẩm đã mở nắp thường không đổi được, trừ khi sản phẩm lỗi hoặc giao sai. Xem thêm ở [Chính sách](/policies).

## Sản phẩm có chính hãng không?
Cửa hàng chịu trách nhiệm về nguồn gốc và chất lượng sản phẩm đăng bán. Sàn duyệt cửa hàng trước khi bán và ẩn sản phẩm vi phạm khi phát hiện. Nếu nghi ngờ hàng giả, hãy báo cho bộ phận hỗ trợ.

## Làm sao hỏi cửa hàng trước khi mua?
Bấm **Nhắn tin cho shop** trên trang sản phẩm hoặc trang cửa hàng. Tin nhắn chỉ bạn và cửa hàng đó đọc được; bạn nhận thông báo khi cửa hàng trả lời.

## Ai được viết đánh giá sản phẩm?
Chỉ khách đã mua và đơn con đã ở trạng thái "Đã giao". Mỗi người viết 1 đánh giá cho 1 sản phẩm và có thể sửa hoặc xóa. Thấy đánh giá không phù hợp, bạn bấm "Báo cáo" để quản trị viên xem xét.

## Beauty Finder có phải là tư vấn y khoa không?
Không. Beauty Finder lọc sản phẩm theo thông tin cửa hàng cung cấp (loại da, thành phần, mối quan tâm, nhóm hương). Nếu da có dấu hiệu bất thường, hãy hỏi ý kiến bác sĩ da liễu.

## Người bán có thấy số điện thoại và địa chỉ của tôi không?
Chỉ người bán của đúng đơn hàng đó thấy tên, số điện thoại và địa chỉ nhận hàng để giao hàng. Sổ địa chỉ của bạn không ai khác đọc được.

## Làm sao để mở cửa hàng?
Vào [Kênh người bán](/seller), điền thông tin cửa hàng và chờ quản trị viên duyệt. Mỗi tài khoản mở được 1 cửa hàng.`,
  },

  policies: {
    title: 'Chính sách',
    intro: '',
    body: `## Đổi trả
- Mỗi cửa hàng tự công bố chính sách đổi trả trên trang cửa hàng (mục "Chính sách cửa hàng"). Hãy đọc trước khi đặt hàng.
- Mỹ phẩm đã mở nắp, đã dùng thường không đổi trả được vì lý do vệ sinh, trừ khi sản phẩm lỗi hoặc giao sai.
- Nếu cửa hàng không giải quyết, bạn gửi khiếu nại tới bộ phận hỗ trợ (trang [Liên hệ](/contact)). Quản trị viên có thể hủy đơn và đánh dấu hoàn tiền khi khiếu nại hợp lệ.

## Vận chuyển
- Phí vận chuyển tính theo từng đơn con (mỗi cửa hàng một phí): {{phi_van_chuyen}}.
- Tiến trình đơn: Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao → Đã giao. Bạn xem từng bước trong Đơn hàng của tôi.
- Với đơn chuyển khoản, cửa hàng chỉ giao khi quản trị viên đã xác nhận thanh toán.

## Thanh toán
- COD: trả tiền khi nhận hàng. Đơn được ghi "Đã thanh toán" khi giao thành công.
- Chuyển khoản QR (mô phỏng): mã QR chỉ chứa mã đơn và số tiền, không gắn tài khoản ngân hàng.
- Đơn chuyển khoản không báo đã chuyển trong 24 giờ sẽ tự hủy và trả hàng về kho.
- Website không thu thập và không lưu số thẻ, số tài khoản ngân hàng hay mã OTP.

## Mã giảm giá
- Mã của sàn do quản trị viên tạo; mã của cửa hàng do cửa hàng tạo. Mỗi mã có thời hạn, đơn tối thiểu và số lượt dùng.
- Mỗi đơn dùng tối đa 1 mã của sàn và 1 mã cho mỗi cửa hàng. Đơn bị hủy được trả lại lượt dùng mã.

## Bảo mật thông tin
- Thông tin thu thập: email, họ tên, số điện thoại, địa chỉ nhận hàng, lịch sử đơn, tin nhắn và đánh giá. Chỉ dùng để xử lý đơn hàng và vận hành sàn.
- Mật khẩu được hệ thống xác thực mã hóa; quản trị viên không xem được mật khẩu.
- Địa chỉ và số điện thoại chỉ chủ tài khoản, người bán của đúng đơn hàng và quản trị viên được xem. Quyền này được kiểm tra trên máy chủ.
- Tin nhắn với cửa hàng chỉ bạn và cửa hàng đó đọc được; tin nhắn gửi bộ phận hỗ trợ do quản trị viên đọc.
- Tên người đánh giá hiển thị dạng rút gọn; email không bao giờ hiển thị công khai.
- Dữ liệu không được bán hay chia sẻ cho bên thứ ba.

## Kiểm duyệt nội dung
- Không đăng sản phẩm giả, sản phẩm cấm, hoặc mô tả cam kết chữa bệnh, điều trị bệnh da liễu.
- Đánh giá không chứa quảng cáo, thông tin cá nhân hay ngôn từ xúc phạm. Đánh giá chê sản phẩm một cách trung thực không bị ẩn.
- Quản trị viên ẩn sản phẩm hoặc đánh giá vi phạm kèm lý do; người đăng thấy lý do đó.`,
  },

  terms: {
    title: 'Điều khoản sử dụng',
    intro: '',
    body: `## 1. Tài khoản
- Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động trên tài khoản của mình.
- Tài khoản vi phạm điều khoản có thể bị tạm khóa; quản trị viên ghi rõ lý do.

## 2. Người mua
- Thông tin nhận hàng phải chính xác. Không đặt đơn ảo hoặc đặt hàng liên tục để giữ hàng.
- Đánh giá phải dựa trên trải nghiệm thật với sản phẩm đã nhận.
- Không dùng tin nhắn để quấy rối, quảng cáo hoặc gửi thông tin cá nhân của người khác.

## 3. Người bán
- Cửa hàng chịu trách nhiệm về nguồn gốc, chất lượng và thông tin sản phẩm đăng bán, bao gồm giá và tồn kho.
- Không đăng nội dung cam kết điều trị bệnh; không dùng thông tin khách hàng ngoài mục đích giao hàng và trả lời tin nhắn.
- Xử lý đơn đúng tiến trình, trả lời tin nhắn và đánh giá một cách lịch sự.

## 4. Vai trò của sàn
{{ten_san}} cung cấp nền tảng kết nối người mua và cửa hàng, kiểm duyệt nội dung vi phạm và hỗ trợ giải quyết khiếu nại. Sàn có thể ẩn sản phẩm, tạm ngưng cửa hàng hoặc khóa tài khoản vi phạm.

## 5. Thay đổi điều khoản
Điều khoản có thể được cập nhật khi website thay đổi tính năng. Phiên bản mới có hiệu lực khi được đăng trên trang này.`,
  },
}
