import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { BrandProvider } from '@/features/brand/BrandProvider'
import { CartProvider } from '@/features/cart/CartProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/StatusPages'
import { ADMIN_ROLES } from '@/types/account'
import { lazyNamed } from './lazyNamed'
import { loaders, usePrefetchRoutes } from './prefetch'

// Mọi trang trừ trang chủ tải riêng khi cần (trang chủ nhẹ hơn). Các trang hay mở được tải sẵn khi trình duyệt rảnh
// hoặc khi người dùng rê chuột / chạm vào liên kết (src/app/prefetch.ts), nên chuyển trang vẫn tức thì.
const ProductsPage = lazyNamed(loaders.products, 'ProductsPage')
const ProductDetailPage = lazyNamed(loaders.productDetail, 'ProductDetailPage')
const ShopsPage = lazyNamed(loaders.shops, 'ShopsPage')
const ShopPage = lazyNamed(loaders.shops, 'ShopPage')
const CartPage = lazyNamed(loaders.cart, 'CartPage')
const AccountPage = lazyNamed(loaders.account, 'AccountPage')
const LoginPage = lazyNamed(loaders.login, 'LoginPage')
const RegisterPage = lazyNamed(loaders.register, 'RegisterPage')
const ForgotPasswordPage = lazyNamed(loaders.password, 'ForgotPasswordPage')
const ResetPasswordPage = lazyNamed(loaders.password, 'ResetPasswordPage')
const AdminLayout = lazyNamed(() => import('@/components/layout/AdminLayout'), 'AdminLayout')
const SellerLayout = lazyNamed(() => import('@/features/seller/SellerLayout'), 'SellerLayout')
const AdminAuditPage = lazyNamed(() => import('@/pages/admin/AdminAuditPage'), 'AdminAuditPage')
const AdminBannersPage = lazyNamed(() => import('@/pages/admin/AdminBannersPage'), 'AdminBannersPage')
const AdminBrandPage = lazyNamed(() => import('@/pages/admin/AdminBrandPage'), 'AdminBrandPage')
const AdminDashboardPage = lazyNamed(() => import('@/pages/admin/AdminDashboardPage'), 'AdminDashboardPage')
const AdminOrdersPage = lazyNamed(() => import('@/pages/admin/AdminOrdersPage'), 'AdminOrdersPage')
const AdminProductsPage = lazyNamed(() => import('@/pages/admin/AdminProductsPage'), 'AdminProductsPage')
const AdminShopsPage = lazyNamed(() => import('@/pages/admin/AdminShopsPage'), 'AdminShopsPage')
const AdminUsersPage = lazyNamed(() => import('@/pages/admin/AdminUsersPage'), 'AdminUsersPage')
const AdminReviewsPage = lazyNamed(() => import('@/pages/admin/AdminReviewsPage'), 'AdminReviewsPage')
const SellerReviewsPage = lazyNamed(() => import('@/pages/seller/SellerReviewsPage'), 'SellerReviewsPage')
const FavoritesPage = lazyNamed(() => import('@/pages/FavoritesPage'), 'FavoritesPage')
const ComparePage = lazyNamed(() => import('@/pages/ComparePage'), 'ComparePage')
const VouchersPage = lazyNamed(() => import('@/pages/VouchersPage'), 'VouchersPage')
const NotificationsPage = lazyNamed(() => import('@/pages/NotificationsPage'), 'NotificationsPage')
const SellerVouchersPage = lazyNamed(() => import('@/pages/seller/SellerVouchersPage'), 'SellerVouchersPage')
const SellerMegaSalePage = lazyNamed(() => import('@/pages/seller/SellerMegaSalePage'), 'SellerMegaSalePage')
const AdminMegaSalePage = lazyNamed(() => import('@/pages/admin/AdminMegaSalePage'), 'AdminMegaSalePage')
const AdminVouchersPage = lazyNamed(() => import('@/pages/admin/AdminVouchersPage'), 'AdminVouchersPage')
const AdminRewardsPage = lazyNamed(() => import('@/pages/admin/AdminRewardsPage'), 'AdminRewardsPage')
const AdminBeautyQuestPage = lazyNamed(() => import('@/pages/admin/AdminBeautyQuestPage'), 'AdminBeautyQuestPage')
const AdminPagesPage = lazyNamed(() => import('@/pages/admin/AdminPagesPage'), 'AdminPagesPage')
const MessagesPage = lazyNamed(() => import('@/pages/MessagesPage'), 'MessagesPage')
const SellerMessagesPage = lazyNamed(() => import('@/pages/MessagesPage'), 'SellerMessagesPage')
const AdminMessagesPage = lazyNamed(() => import('@/pages/MessagesPage'), 'AdminMessagesPage')
const BrandsPage = lazyNamed(loaders.brands, 'BrandsPage')
const SkincareArchitectPage = lazyNamed(loaders.architect, 'SkincareArchitectPage')
const BeautyQuestLayout = lazyNamed(loaders.beautyQuest, 'BeautyQuestLayout')
const BqHomePage = lazyNamed(loaders.beautyQuest, 'BqHomePage')
const BqQuizPage = lazyNamed(loaders.beautyQuest, 'BqQuizPage')
const BqRoutinePage = lazyNamed(loaders.beautyQuest, 'BqRoutinePage')
const BqLearnPage = lazyNamed(loaders.beautyQuest, 'BqLearnPage')
const BqReflectPage = lazyNamed(loaders.beautyQuest, 'BqReflectPage')
const BqRoadmapPage = lazyNamed(loaders.beautyQuest, 'BqRoadmapPage')
const BqGiftsPage = lazyNamed(loaders.beautyQuest, 'BqGiftsPage')
const MegaSalePage = lazyNamed(loaders.megaSale, 'MegaSalePage')
const AboutPage = lazyNamed(() => import('@/pages/InfoPages'), 'AboutPage')
const ContactPage = lazyNamed(() => import('@/pages/InfoPages'), 'ContactPage')
const FaqPage = lazyNamed(() => import('@/pages/InfoPages'), 'FaqPage')
const PoliciesPage = lazyNamed(() => import('@/pages/InfoPages'), 'PoliciesPage')
const TermsPage = lazyNamed(() => import('@/pages/InfoPages'), 'TermsPage')
const BeautyFinderPage = lazyNamed(loaders.beautyFinder, 'BeautyFinderPage')
const CheckoutPage = lazyNamed(loaders.checkout, 'CheckoutPage')
const SellerDashboardPage = lazyNamed(() => import('@/pages/seller/SellerDashboardPage'), 'SellerDashboardPage')
const SellerOrdersPage = lazyNamed(() => import('@/pages/seller/SellerOrdersPage'), 'SellerOrdersPage')
const SellerProductFormPage = lazyNamed(() => import('@/pages/seller/SellerProductFormPage'), 'SellerProductFormPage')
const SellerProductsPage = lazyNamed(() => import('@/pages/seller/SellerProductsPage'), 'SellerProductsPage')
const SellerShopSettingsPage = lazyNamed(() => import('@/pages/seller/SellerShopSettingsPage'), 'SellerShopSettingsPage')
const OrdersPage = lazyNamed(() => import('@/pages/OrdersPage'), 'OrdersPage')
const OrderDetailPage = lazyNamed(() => import('@/pages/OrdersPage'), 'OrderDetailPage')

function RoutePrefetch() {
  usePrefetchRoutes()
  return null
}

export function App() {
  return (
    <ThemeProvider>
      <BrandProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <RoutePrefetch />
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="products/:slug" element={<ProductDetailPage />} />
                  <Route path="shops" element={<ShopsPage />} />
                  <Route path="shops/:slug" element={<ShopPage />} />
                  <Route path="beauty-finder" element={<BeautyFinderPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="compare" element={<ComparePage />} />
                  <Route path="brands" element={<BrandsPage />} />
                  <Route path="skincare-architect" element={<SkincareArchitectPage />} />
                  <Route path="beauty-quest" element={<BeautyQuestLayout />}>
                    <Route index element={<BqHomePage />} />
                    <Route path="quiz" element={<BqQuizPage />} />
                    <Route path="routine" element={<BqRoutinePage />} />
                    <Route path="learn" element={<BqLearnPage />} />
                    <Route path="learn/:slug" element={<BqLearnPage />} />
                    <Route path="reflect" element={<BqReflectPage />} />
                    <Route path="roadmap" element={<BqRoadmapPage />} />
                    <Route path="hop-qua" element={<BqGiftsPage />} />
                  </Route>
                  <Route path="mega-sale" element={<MegaSalePage />} />

                  {/* Trang thông tin */}
                  <Route path="about" element={<AboutPage />} />
                  <Route path="contact" element={<ContactPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="terms" element={<TermsPage />} />

                  {/* Tài khoản */}
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="reset-password" element={<ResetPasswordPage />} />
                  <Route
                    path="account"
                    element={
                      <RequireAuth>
                        <AccountPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="vouchers"
                    element={
                      <RequireAuth>
                        <VouchersPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="messages"
                    element={
                      <RequireAuth>
                        <MessagesPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="notifications"
                    element={
                      <RequireAuth>
                        <NotificationsPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="favorites"
                    element={
                      <RequireAuth>
                        <FavoritesPage />
                      </RequireAuth>
                    }
                  />

                  {/* Quản trị: giao diện chặn ở đây, database chặn thêm một lần nữa */}
                  <Route
                    path="admin"
                    element={
                      <RequireAuth roles={ADMIN_ROLES}>
                        <AdminLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="shops" element={<AdminShopsPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="reviews" element={<AdminReviewsPage />} />
                    <Route path="vouchers" element={<AdminVouchersPage />} />
                    <Route path="rewards" element={<AdminRewardsPage />} />
                    <Route path="beauty-quest" element={<AdminBeautyQuestPage />} />
                    <Route path="mega-sale" element={<AdminMegaSalePage />} />
                    <Route path="messages" element={<AdminMessagesPage />} />
                    <Route path="pages" element={<AdminPagesPage />} />
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="audit" element={<AdminAuditPage />} />
                    <Route path="brand" element={<AdminBrandPage />} />
                    <Route path="banners" element={<AdminBannersPage />} />
                  </Route>

                  {/* Đặt hàng và đơn của tôi: cần đăng nhập; database tính giá và kiểm tra quyền */}
                  <Route
                    path="checkout"
                    element={
                      <RequireAuth>
                        <CheckoutPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="orders"
                    element={
                      <RequireAuth>
                        <OrdersPage />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="orders/:code"
                    element={
                      <RequireAuth>
                        <OrderDetailPage />
                      </RequireAuth>
                    }
                  />
                  {/* Kênh người bán: ai đăng nhập cũng vào được để mở shop; database kiểm tra quyền chủ shop */}
                  <Route
                    path="seller"
                    element={
                      <RequireAuth>
                        <SellerLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<SellerDashboardPage />} />
                    <Route path="products" element={<SellerProductsPage />} />
                    <Route path="products/new" element={<SellerProductFormPage />} />
                    <Route path="products/:id" element={<SellerProductFormPage />} />
                    <Route path="orders" element={<SellerOrdersPage />} />
                    <Route path="reviews" element={<SellerReviewsPage />} />
                    <Route path="vouchers" element={<SellerVouchersPage />} />
                    <Route path="mega-sale" element={<SellerMegaSalePage />} />
                    <Route path="messages" element={<SellerMessagesPage />} />
                    <Route path="shop" element={<SellerShopSettingsPage />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </BrandProvider>
    </ThemeProvider>
  )
}
