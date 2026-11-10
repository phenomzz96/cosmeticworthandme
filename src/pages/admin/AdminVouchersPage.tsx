/** MÃ GIẢM GIÁ TOÀN SÀN — /admin/vouchers. Chỉ Admin; mọi thao tác được ghi nhật ký. */
import { VoucherManager } from '@/features/vouchers/VoucherManager'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function AdminVouchersPage() {
  useDocumentTitle('Mã giảm giá toàn sàn')
  return (
    <div className="container-page py-6">
      <VoucherManager
        shopId={null}
        title="Mã giảm giá toàn sàn"
        intro="Mã toàn sàn áp dụng cho mọi cửa hàng, giảm trên tổng tiền hàng (sau mã của shop) và được chia cho các đơn con theo tỷ lệ. Mỗi đơn dùng tối đa 1 mã toàn sàn."
      />
    </div>
  )
}
