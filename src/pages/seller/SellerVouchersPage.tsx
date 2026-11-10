/** MÃ GIẢM GIÁ CỦA SHOP — /seller/vouchers. Chỉ shop đã được duyệt mới tạo được mã (database kiểm tra). */
import { Alert } from '@/components/ui/Form'
import { useSeller } from '@/features/seller/SellerLayout'
import { VoucherManager } from '@/features/vouchers/VoucherManager'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function SellerVouchersPage() {
  useDocumentTitle('Mã giảm giá của shop')
  const { shop } = useSeller()
  return (
    <div className="container-page py-6">
      {shop.status !== 'active' ? (
        <Alert kind="info">Cửa hàng cần được quản trị viên duyệt trước khi tạo mã giảm giá.</Alert>
      ) : (
        <VoucherManager
          shopId={shop.id}
          title="Mã giảm giá"
          intro="Mã chỉ áp dụng cho sản phẩm của shop bạn. Khách nhập mã ở giỏ hàng; số tiền giảm trừ vào đơn của shop. Mã đã có người dùng thì không đổi được chữ mã."
        />
      )}
    </div>
  )
}
