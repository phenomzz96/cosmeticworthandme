/**
 * TRANG THÔNG TIN: Giới thiệu, Liên hệ, Câu hỏi thường gặp, Chính sách, Điều khoản.
 * Nội dung viết cho dự án học tập: nói rõ website chưa có giao dịch thật, không cam kết điều trị.
 * Tên thương hiệu và phí vận chuyển lấy từ cài đặt website (Admin chỉnh ở /admin/brand).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs, button } from '@/components/ui/primitives'
import { brand, PLACEHOLDER, team } from '@/config/brand'
import { useBrand } from '@/features/brand/BrandProvider'
import { formatPrice } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const infoLinks = [
  { to: '/about', label: 'Giới thiệu' },
  { to: '/faq', label: 'Câu hỏi thường gặp' },
  { to: '/policies', label: 'Chính sách' },
  { to: '/terms', label: 'Điều khoản sử dụng' },
  { to: '/contact', label: 'Liên hệ' },
]

function InfoLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: title }]} />
      <div className="mt-4 grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Trang thông tin" className="order-last lg:order-first">
          <ul className="flex flex-wrap gap-2 lg:sticky lg:top-24 lg:flex-col lg:gap-1">
            {infoLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="block rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
          <div className="mt-6 space-y-8">{children}</div>
        </article>
      </div>
    </div>
  )
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-40">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-text [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
    </section>
  )
}

/** Ghi chú dự án học tập — hiện ở mọi trang chính sách */
function StudyNote() {
  const { settings } = useBrand()
  return (
    <p className="rounded-card border border-border bg-surface-2 p-4 text-sm text-muted">
      {settings.name} là website phục vụ học tập (học phần {team.course}). Website chưa có giao dịch, thanh toán hay giao hàng thật; các chính sách dưới
      đây mô tả cách hệ thống được thiết kế để hoạt động.
    </p>
  )
}

export function AboutPage() {
  const { settings } = useBrand()
  return (
    <InfoLayout title="Giới thiệu" intro={`${settings.name} là sàn mỹ phẩm nhiều cửa hàng: mỗi cửa hàng tự đăng bán, sàn kết nối người mua với cửa hàng phù hợp.`}>
      <Section title="Chúng tôi làm gì">
        <ul>
          <li>Gom skincare, makeup, haircare, body care và dụng cụ làm đẹp từ nhiều cửa hàng về một nơi, tìm kiếm không cần gõ dấu.</li>
          <li>
            <Link to="/beauty-finder" className="font-medium text-primary hover:underline">Beauty Finder</Link> gợi ý sản phẩm theo loại da, mối quan tâm và ngân
            sách, kèm lý do vì sao sản phẩm phù hợp. Gợi ý dựa trên thông tin sản phẩm, không thay thế tư vấn của bác sĩ da liễu.
          </li>
          <li>Đánh giá chỉ đến từ khách đã mua và đã nhận hàng, nên điểm số phản ánh trải nghiệm thật.</li>
        </ul>
      </Section>
      <Section title="Cách sàn hoạt động">
        <ul>
          <li>Người bán đăng ký mở cửa hàng; quản trị viên duyệt trước khi cửa hàng được bán.</li>
          <li>Một đơn hàng có sản phẩm của nhiều shop được tách thành đơn con cho từng shop; mỗi shop tự xác nhận và giao phần của mình.</li>
          <li>Giá, phí vận chuyển và tồn kho được máy chủ kiểm tra lại khi đặt hàng.</li>
          <li>Quản trị viên kiểm duyệt cửa hàng, sản phẩm và đánh giá vi phạm; mọi thao tác quản trị đều được ghi nhật ký.</li>
        </ul>
      </Section>
      <Section title="Về dự án">
        <p>
          Website được thực hiện bởi <span className={team.name ? 'font-medium' : 'italic text-muted'}>{team.name ?? PLACEHOLDER.teamName}</span> trong học phần{' '}
          {team.course}.
        </p>
        {team.members.length > 0 && <p>Thành viên: {team.members.join(', ')}.</p>}
      </Section>
      <div className="flex flex-wrap gap-3">
        <Link to="/products" className={button('primary')}>Xem sản phẩm</Link>
        <Link to="/seller" className={button('secondary')}>Mở cửa hàng</Link>
      </div>
    </InfoLayout>
  )
}

export function ContactPage() {
  return (
    <InfoLayout title="Liên hệ" intro="Chọn đúng nơi liên hệ để được trả lời nhanh nhất.">
      <Section title="Về một đơn hàng hoặc sản phẩm">
        <p>
          Liên hệ trực tiếp cửa hàng bán sản phẩm: email và số điện thoại của cửa hàng nằm trên trang cửa hàng (mục "Liên hệ cửa hàng"). Bạn cũng xem được tiến
          trình đơn trong <Link to="/orders" className="font-medium text-primary hover:underline">Đơn hàng của tôi</Link>.
        </p>
      </Section>
      <Section title="Khiếu nại, báo cáo vi phạm, góp ý cho sàn">
        {brand.contact.email ? (
          <p>
            Gửi email tới{' '}
            <a href={`mailto:${brand.contact.email}`} className="font-medium text-primary hover:underline">
              {brand.contact.email}
            </a>
            , ghi rõ mã đơn hàng (dạng WM…) hoặc đường dẫn sản phẩm/cửa hàng.
          </p>
        ) : (
          <p className="italic text-muted">Email hỗ trợ của sàn: chưa cập nhật.</p>
        )}
        {brand.contact.hotline && <p>Hotline: {brand.contact.hotline}</p>}
        <p className="text-sm text-muted">Không gửi mật khẩu, mã xác minh hay thông tin thẻ ngân hàng qua bất kỳ kênh liên hệ nào.</p>
      </Section>
      <Section title="Muốn bán hàng trên sàn">
        <p>
          Đăng nhập rồi vào <Link to="/seller" className="font-medium text-primary hover:underline">Kênh người bán</Link> để đăng ký cửa hàng. Quản trị viên sẽ
          duyệt hoặc phản hồi lý do nếu cần bổ sung thông tin.
        </p>
      </Section>
    </InfoLayout>
  )
}

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: 'Tôi có cần tài khoản để mua hàng không?',
    a: 'Bạn xem sản phẩm và thêm vào giỏ mà không cần đăng nhập. Khi đặt hàng cần đăng nhập để lưu địa chỉ và theo dõi đơn; giỏ hàng trên trình duyệt sẽ được gộp vào tài khoản.',
  },
  {
    q: 'Vì sao đơn của tôi bị tách thành nhiều đơn con?',
    a: 'Mỗi cửa hàng tự đóng gói và giao phần sản phẩm của mình, nên đơn có sản phẩm từ 2 shop sẽ có 2 đơn con, mỗi đơn con có phí vận chuyển và tiến trình riêng.',
  },
  {
    q: 'Có những cách thanh toán nào?',
    a: 'Thanh toán khi nhận hàng (COD) và chuyển khoản bằng mã QR mô phỏng. Mã QR chỉ chứa mã đơn và số tiền, không gắn tài khoản ngân hàng và không có tiền thật.',
  },
  {
    q: 'Tôi hủy đơn được không?',
    a: 'Được, khi đơn con còn ở trạng thái "Chờ xác nhận". Sau khi cửa hàng đã xác nhận, hãy liên hệ cửa hàng. Đơn đã thanh toán mà bị hủy sẽ được đánh dấu chờ hoàn tiền.',
  },
  {
    q: 'Ai được viết đánh giá sản phẩm?',
    a: 'Chỉ khách đã mua và đơn con đã ở trạng thái "Đã giao". Mỗi người viết 1 đánh giá cho 1 sản phẩm và có thể sửa hoặc xóa. Tên người đánh giá được hiển thị rút gọn.',
  },
  {
    q: 'Beauty Finder có phải là tư vấn y khoa không?',
    a: 'Không. Beauty Finder lọc sản phẩm theo thông tin cửa hàng cung cấp (loại da, thành phần, mối quan tâm). Nếu da có dấu hiệu bất thường, hãy hỏi ý kiến bác sĩ da liễu.',
  },
  {
    q: 'Người bán có thấy số điện thoại và địa chỉ của tôi không?',
    a: 'Chỉ người bán của đúng đơn hàng đó thấy tên, số điện thoại và địa chỉ nhận hàng để giao hàng. Sổ địa chỉ của bạn không ai khác đọc được.',
  },
  {
    q: 'Làm sao để mở cửa hàng?',
    a: (
      <>
        Vào <Link to="/seller" className="font-medium text-primary hover:underline">Kênh người bán</Link>, điền thông tin cửa hàng và chờ quản trị viên duyệt. Mỗi
        tài khoản mở được 1 cửa hàng.
      </>
    ),
  },
]

export function FaqPage() {
  return (
    <InfoLayout title="Câu hỏi thường gặp">
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {faqs.map((f) => (
          <li key={f.q}>
            <details className="group p-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
                {f.q}
              </summary>
              <div className="mt-2 pl-5 text-sm leading-relaxed text-muted">{f.a}</div>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Chưa thấy câu trả lời? Xem trang <Link to="/contact" className="font-medium text-primary hover:underline">Liên hệ</Link>.
      </p>
    </InfoLayout>
  )
}

export function PoliciesPage() {
  const { settings } = useBrand()
  const fee = settings.shippingFee
  return (
    <InfoLayout title="Chính sách">
      <StudyNote />
      <nav aria-label="Mục lục" className="flex flex-wrap gap-2 text-sm">
        {[
          ['#doi-tra', 'Đổi trả'],
          ['#van-chuyen', 'Vận chuyển'],
          ['#thanh-toan', 'Thanh toán'],
          ['#bao-mat', 'Bảo mật thông tin'],
          ['#kiem-duyet', 'Kiểm duyệt nội dung'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-border px-3 py-1 hover:border-primary hover:text-primary">
            {label}
          </a>
        ))}
      </nav>
      <Section id="doi-tra" title="Đổi trả">
        <ul>
          <li>Mỗi cửa hàng tự công bố chính sách đổi trả trên trang cửa hàng (mục "Chính sách cửa hàng"). Hãy đọc trước khi đặt hàng.</li>
          <li>Mỹ phẩm đã mở nắp, đã dùng thường không đổi trả được vì lý do vệ sinh, trừ khi sản phẩm lỗi hoặc giao sai.</li>
          <li>Nếu cửa hàng không giải quyết, bạn gửi khiếu nại tới sàn (trang Liên hệ). Quản trị viên có thể hủy đơn và đánh dấu hoàn tiền khi khiếu nại hợp lệ.</li>
        </ul>
      </Section>
      <Section id="van-chuyen" title="Vận chuyển">
        <ul>
          <li>Phí vận chuyển tính theo từng đơn con (mỗi cửa hàng một phí): {fee > 0 ? `${formatPrice(fee)} / cửa hàng` : 'hiện đang miễn phí'}.</li>
          <li>Tiến trình đơn: Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao → Đã giao. Bạn xem từng bước trong Đơn hàng của tôi.</li>
          <li>Với đơn chuyển khoản, cửa hàng chỉ giao khi quản trị viên đã xác nhận thanh toán.</li>
        </ul>
      </Section>
      <Section id="thanh-toan" title="Thanh toán">
        <ul>
          <li>COD: trả tiền khi nhận hàng. Đơn được ghi "Đã thanh toán" khi giao thành công.</li>
          <li>Chuyển khoản QR (mô phỏng): mã QR chỉ chứa mã đơn và số tiền, không gắn tài khoản ngân hàng, không có tiền thật được chuyển.</li>
          <li>Website không thu thập và không lưu số thẻ, số tài khoản ngân hàng hay mã OTP.</li>
        </ul>
      </Section>
      <Section id="bao-mat" title="Bảo mật thông tin">
        <ul>
          <li>Thông tin thu thập: email, họ tên, số điện thoại, địa chỉ nhận hàng, lịch sử đơn và đánh giá. Chỉ dùng để xử lý đơn hàng và vận hành sàn.</li>
          <li>Mật khẩu được hệ thống xác thực (Supabase Auth) mã hóa; nhóm phát triển và quản trị viên không xem được mật khẩu.</li>
          <li>Địa chỉ và số điện thoại chỉ chủ tài khoản, người bán của đúng đơn hàng và quản trị viên được xem. Quyền này được kiểm tra trên máy chủ.</li>
          <li>Tên người đánh giá hiển thị dạng rút gọn; email không bao giờ hiển thị công khai.</li>
          <li>Dữ liệu không được bán hay chia sẻ cho bên thứ ba.</li>
        </ul>
      </Section>
      <Section id="kiem-duyet" title="Kiểm duyệt nội dung">
        <ul>
          <li>Không đăng sản phẩm giả, sản phẩm cấm, hoặc mô tả cam kết chữa bệnh, điều trị bệnh da liễu.</li>
          <li>Đánh giá không chứa quảng cáo, thông tin cá nhân hay ngôn từ xúc phạm. Đánh giá chê sản phẩm một cách trung thực không bị ẩn.</li>
          <li>Quản trị viên ẩn sản phẩm hoặc đánh giá vi phạm kèm lý do; người đăng thấy lý do đó.</li>
        </ul>
      </Section>
    </InfoLayout>
  )
}

export function TermsPage() {
  const { settings } = useBrand()
  return (
    <InfoLayout title="Điều khoản sử dụng">
      <StudyNote />
      <Section title="1. Tài khoản">
        <ul>
          <li>Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động trên tài khoản của mình.</li>
          <li>Tài khoản vi phạm điều khoản có thể bị tạm khóa; quản trị viên ghi rõ lý do.</li>
        </ul>
      </Section>
      <Section title="2. Người mua">
        <ul>
          <li>Thông tin nhận hàng phải chính xác. Không đặt đơn ảo hoặc đặt hàng liên tục để giữ hàng.</li>
          <li>Đánh giá phải dựa trên trải nghiệm thật với sản phẩm đã nhận.</li>
        </ul>
      </Section>
      <Section title="3. Người bán">
        <ul>
          <li>Cửa hàng chịu trách nhiệm về nguồn gốc, chất lượng và thông tin sản phẩm đăng bán, bao gồm giá và tồn kho.</li>
          <li>Không đăng nội dung cam kết điều trị bệnh; không dùng thông tin khách hàng ngoài mục đích giao hàng.</li>
          <li>Xử lý đơn đúng tiến trình và trả lời đánh giá một cách lịch sự.</li>
        </ul>
      </Section>
      <Section title="4. Vai trò của sàn">
        <p>
          {settings.name} cung cấp nền tảng kết nối người mua và cửa hàng, kiểm duyệt nội dung vi phạm và hỗ trợ giải quyết khiếu nại. Sàn có thể ẩn sản phẩm,
          tạm ngưng cửa hàng hoặc khóa tài khoản vi phạm.
        </p>
      </Section>
      <Section title="5. Thay đổi điều khoản">
        <p>Điều khoản có thể được cập nhật khi website thay đổi tính năng. Phiên bản mới có hiệu lực khi được đăng trên trang này.</p>
      </Section>
    </InfoLayout>
  )
}
