import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { missingBrandAssets } from '@/config/brand'
import { isSupabaseConfigured } from '@/lib/supabase'
import '@/styles/index.css'

if (import.meta.env.DEV) {
  const missing = missingBrandAssets()
  if (missing.length) {
    console.info(`[Thương hiệu] Còn thiếu: ${missing.join(', ')}. Cập nhật tại src/config/brand.ts`)
  }
  if (!isSupabaseConfigured) {
    console.info('[Supabase] Chưa cấu hình VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env.local: tài khoản và cài đặt thương hiệu chưa hoạt động.')
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
