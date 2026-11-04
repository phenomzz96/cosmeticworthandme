import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { BrandProvider } from '@/features/brand/BrandProvider'
import { CartProvider } from '@/features/cart/CartProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { AccountPage } from '@/pages/AccountPage'
import { CartPage } from '@/pages/CartPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/PasswordPages'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ShopPage, ShopsPage } from '@/pages/ShopPage'
import { NotFoundPage } from '@/pages/StatusPages'
import { ADMIN_ROLES } from '@/types/account'
import { lazyNamed } from './lazyNamed'

// Trang quản trị, kênh người bán, đặt hàng, Beauty Finder: tải riêng khi cần để trang chủ nhẹ hơn
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
const AboutPage = lazyNamed(() => import('@/pages/InfoPages'), 'AboutPage')
const ContactPage = lazyNamed(() => import('@/pages/InfoPages'), 'ContactPage')
const FaqPage = lazyNamed(() => import('@/pages/InfoPages'), 'FaqPage')
const PoliciesPage = lazyNamed(() => import('@/pages/InfoPages'), 'PoliciesPage')
const TermsPage = lazyNamed(() => import('@/pages/InfoPages'), 'TermsPage')
const BeautyFinderPage = lazyNamed(() => import('@/pages/BeautyFinderPage'), 'BeautyFinderPage')
const CheckoutPage = lazyNamed(() => import('@/pages/CheckoutPage'), 'CheckoutPage')
const SellerDashboardPage = lazyNamed(() => import('@/pages/seller/SellerDashboardPage'), 'SellerDashboardPage')
const SellerOrdersPage = lazyNamed(() => import('@/pages/seller/SellerOrdersPage'), 'SellerOrdersPage')
const SellerProductFormPage = lazyNamed(() => import('@/pages/seller/SellerProductFormPage'), 'SellerProductFormPage')
const SellerProductsPage = lazyNamed(() => import('@/pages/seller/SellerProductsPage'), 'SellerProductsPage')
const SellerShopSettingsPage = lazyNamed(() => import('@/pages/seller/SellerShopSettingsPage'), 'SellerShopSettingsPage')
const OrdersPage = lazyNamed(() => import('@/pages/OrdersPage'), 'OrdersPage')
const OrderDetailPage = lazyNamed(() => import('@/pages/OrdersPage'), 'OrderDetailPage')

export function App() {
  return (
    <ThemeProvider>
      <BrandProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="products/:slug" element={<ProductDetailPage />} />
                  <Route path="shops" element={<ShopsPage />} />
                  <Route path="shops/:slug" element={<ShopPage />} />
                  <Route path="beauty-finder" element={<BeautyFinderPage />} />
                  <Route path="cart" element={<CartPage />} />

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
