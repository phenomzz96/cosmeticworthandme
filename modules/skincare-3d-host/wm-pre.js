// Worth & Me — chạy trước module (script thường, trước js/main.js). Xem README.md cùng thư mục.
;(function () {
  try {
    var p = new URLSearchParams(location.search)
    // Website lưu hồ sơ "HOST" khi nhúng; mở module độc lập thì hồ sơ này không tồn tại → dùng lại hồ sơ mẫu
    if (!p.get('hostOrigin') && /HOST/.test(localStorage.getItem('skc:uid') || '')) localStorage.removeItem('skc:uid')
    if (p.get('embed') === '1') document.documentElement.classList.add('wm-embed')
    document.documentElement.setAttribute('data-wm-theme', p.get('theme') === 'dark' ? 'dark' : 'light')
    var a = p.get('accent')
    if (a && /^#[0-9a-f]{6}$/i.test(a)) document.documentElement.style.setProperty('--wm-acc', a)
  } catch (e) {
    /* không chặn module */
  }
})()
