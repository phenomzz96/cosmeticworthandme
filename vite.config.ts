import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { brand } from './src/config/brand'

/** Điền tên thương hiệu từ src/config/brand.ts vào index.html (tiêu đề, mô tả, favicon) */
function brandHtml(): Plugin {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return {
    name: 'brand-html',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replaceAll('%BRAND_NAME%', escape(brand.name))
          .replaceAll('%BRAND_DESCRIPTION%', escape(brand.description))
          .replaceAll('%BRAND_FAVICON%', escape(brand.favicon)),
    },
  }
}

export default defineConfig({
  plugins: [brandHtml(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
