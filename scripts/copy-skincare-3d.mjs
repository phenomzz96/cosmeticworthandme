/**
 * Chép phần chạy được của tính năng chuyên biệt "Skincare Architect 3D" (modules/skincare-3d, do nhóm 3D bàn giao)
 * vào public/skincare-3d để Vite đưa vào bản build. Tự chạy trước `npm run dev` và `npm run build`.
 *
 * Chỉ chép index.html, css/, js/, assets/ — không chép tools/ (file Blender), tests/, docs/ (ảnh chụp) lên website.
 * KHÔNG sửa code của module: muốn thay đổi tính năng 3D, sửa trong modules/skincare-3d (nhóm 3D phụ trách).
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'modules', 'skincare-3d')
const out = join(root, 'public', 'skincare-3d')

if (!existsSync(join(src, 'index.html'))) {
  console.warn('[skincare-3d] Không thấy modules/skincare-3d/index.html, bỏ qua.')
  process.exit(0)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const item of ['index.html', 'css', 'js', 'assets']) {
  cpSync(join(src, item), join(out, item), { recursive: true })
}
writeFileSync(join(out, 'README.txt'), 'Thư mục tự sinh từ modules/skincare-3d (scripts/copy-skincare-3d.mjs). Không sửa ở đây.\n')
console.log('[skincare-3d] Đã chép module 3D vào public/skincare-3d')
