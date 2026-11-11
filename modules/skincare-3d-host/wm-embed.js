// Worth & Me — chạy sau module (type=module, sau js/main.js). Xem README.md cùng thư mục.
const params = new URLSearchParams(location.search)
const HOST = params.get('hostOrigin')
const root = document.documentElement

const setTheme = (t) => root.setAttribute('data-wm-theme', t === 'dark' ? 'dark' : 'light')
const setAccent = (hex) => {
  if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) root.style.setProperty('--wm-acc', hex)
}
const notify = (type, detail) => {
  if (HOST && window.parent !== window) window.parent.postMessage({ source: 'wm-embed', type, detail }, HOST)
}

if (root.classList.contains('wm-embed')) {
  // Website đã là cửa hàng: mở thẳng phần "Routine của tôi" của module
  document.querySelector('[data-act="view"][data-v="feature"]')?.click()
  document.title = 'Skincare Architect 3D'
}

/**
 * Thêm sản phẩm vào chu trình bằng chính nút "Thêm" của module (module tự ghi nhãn "chưa mua").
 * Báo lại: added = đã thêm; skipped = đã có trong chu trình hoặc không thuộc danh mục; blocked = module chưa cho thêm (chưa chọn mục tiêu).
 */
function addProducts(ids) {
  const added = []
  const skipped = []
  const blocked = []
  for (const raw of ids) {
    const id = String(raw)
    const sel = document.getElementById('addSel')
    if (!sel) {
      blocked.push(id)
      continue
    }
    const opt = [...sel.options].find((o) => o.value === id)
    if (!opt) {
      skipped.push(id)
      continue
    }
    sel.value = opt.value
    document.querySelector('[data-act="add"]')?.click()
    added.push(id)
  }
  if (added.length) document.querySelector('[data-act="stage"][data-s="routine"]')?.click()
  notify('wm:selected', { added, skipped, blocked })
}

if (HOST)
  window.addEventListener('message', (e) => {
    if (e.origin !== HOST || e.source !== window.parent) return
    const m = e.data
    if (!m || typeof m !== 'object' || m.source !== 'wm-host') return
    if (m.type === 'wm:theme') {
      setTheme(m.theme)
      setAccent(m.accent)
    } else if (m.type === 'wm:select' && Array.isArray(m.ids)) addProducts(m.ids.slice(0, 12))
  })

notify('wm:embed-ready', {})
