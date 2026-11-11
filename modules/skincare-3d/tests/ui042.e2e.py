# Kiểm thử giao diện 0.4.2 – bản tóm tắt cảnh báo, nhóm cảnh báo, mở/đóng chi tiết, bàn phím, mobile, đổi sản phẩm/tài khoản,
# đồng bộ với thẻ bước ở mô hình (cần Python + Playwright + Chromium).
#   python -m http.server 8000                       (trong thư mục dự án)
#   python tests/ui042.e2e.py http://localhost:8000   [--three-dir=/đường/dẫn/three]
# Không cần Three.js: nếu CDN không tải được, mô hình tự chuyển sang 2D và các kiểm tra ở bước 3 vẫn chạy (thẻ bước dùng chung cho 3D/2D).
import sys, os
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = (args[0] if args else 'http://localhost:8000')
THREE = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--three-dir=')), None)
BASE = URL if URL.endswith('.html') else URL.rstrip('/') + '/'
ok = 0
def check(name, cond, extra=''):
    global ok
    if not cond: raise AssertionError(f'{name} {extra}')
    ok += 1; print('✓', name)

def route_three(pg):
    if not THREE: return
    def h(route):
        part = route.request.url.split('/npm/three@0.160.0/', 1)
        f = os.path.join(THREE, part[1]) if len(part) == 2 else None
        if f and os.path.isfile(f): route.fulfill(path=f, content_type='application/javascript')
        else: route.abort()
    pg.route('**/cdn.jsdelivr.net/**', h)

def page(b, w=1366, h=900, touch=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    route_three(pg)
    return ctx, pg, errs

vis = lambda pg, sel: pg.locator(sel).first.is_visible()
no_hscroll = lambda pg: pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
def start(pg, uid, goals):
    pg.goto(BASE); pg.evaluate(f'localStorage.clear();localStorage.setItem("skc:uid","{uid}")'); pg.reload()
    pg.click('nav [data-v=feature]')
    for g in goals: pg.click(f'#quiz label.opt:has(input[value={g}])')
    pg.click('[data-act=quiz]')
    pg.wait_for_selector('#routine .wsum')
txt = lambda pg, sel: pg.inner_text(sel)
# văn bản cảnh báo đang HIỂN THỊ trên trang Routine (không tính phần thu gọn): khối tóm tắt + nhãn bước
def visible_warn_text(pg):
    return pg.evaluate("""()=>{const q=s=>[...document.querySelectorAll(s)];
      const sum=q('#routine .wsum-head, #routine .wsum-list').map(e=>e.innerText).join(' ');
      const tags=q('#routine .step-warn .tag').map(e=>e.innerText).join(' ');return (sum+' '+tags).replace(/\\s+/g,' ').trim()}""")

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 1. User B + mục tiêu mụn & dễ kích ứng: 8 cảnh báo gốc → khối tóm tắt ----------
    for W, touch in [(1440, False), (768, False), (390, True)]:
        ctx, pg, errs = page(b, W, 900 if W > 500 else 800, touch)
        start(pg, 'B', ['acne', 'sensitive'])
        tag = f'[{W}px]'
        check(f'{tag} chỉ có MỘT khối tổng hợp cảnh báo; không còn dãy thẻ cảnh báo đỏ/vàng liên tiếp', pg.locator('#routine .wsum').count() == 1 and pg.locator('#routine > .warns .alert, #routine .wsum details.alert').count() == 0)
        s = txt(pg, '#routine .wsum')
        check(f'{tag} tóm tắt nêu trạng thái, số mục cần xem lại và từng nhóm', 'Routine chưa hoàn chỉnh' in s and '6 mục cần xem lại, thuộc 3 nhóm' in s
              and 'Chưa đưa vào routine' in s and 'Trùng hoặc chồng chéo' in s and 'Thiếu bước hoặc dữ liệu' in s, s)
        check(f'{tag} tên sản phẩm bị giữ ngoài routine thấy ngay ở trạng thái thu gọn', 'Serum Retinol Renew' in s and 'Gel BHA Clear' in s)
        check(f'{tag} không lặp: 8 thẻ cũ → {pg.locator("#routine .wsum .wl").count()} dòng; mỗi nhóm đúng một dòng', pg.locator('#routine .wsum .wl').count() == 3)
        det = pg.locator('#warnMore')
        check(f'{tag} chi tiết thu gọn mặc định; lý do dài chưa hiện', not det.evaluate('e=>e.open') and not pg.locator('#warnMore .wdet').first.is_visible())
        vt = visible_warn_text(pg)
        check(f'{tag} lượng chữ cảnh báo hiển thị ngay giảm (≤ 520 ký tự; 0.4.1 đo được 848 ký tự cho cùng phạm vi)', len(vt) <= 520, f'{len(vt)}: {vt}')
        check(f'{tag} mỗi bước chỉ có tối đa MỘT nhãn ngắn', pg.evaluate("[...document.querySelectorAll('#routine li.step')].every(li=>li.querySelectorAll('.step-warn > .tag').length<=1)") and pg.locator('#routine li.step .step-warn').count() >= 1)
        check(f'{tag} không cuộn ngang', no_hscroll(pg))
        h = pg.locator('#routine .wsum').bounding_box()['height']
        check(f'{tag} khối tóm tắt không quá dài (≤ {420 if W < 500 else 300}px)', h <= (420 if W < 500 else 300), h)

        # bàn phím: Tab tới nút/summary, Enter mở, Space đóng
        pg.focus('#warnMore > summary'); pg.keyboard.press('Enter')
        check(f'{tag} Enter trên "Xem giải thích chi tiết" mở phần chi tiết', det.evaluate('e=>e.open') and pg.locator('#warnMore .wdet').is_visible())
        d = txt(pg, '#warnMore')
        check(f'{tag} chi tiết có lý do đầy đủ, sản phẩm liên quan và cảnh báo gốc của từng mục',
              'Hệ thống không kết luận sản phẩm gây hại' in d and 'Sản phẩm liên quan: Serum Retinol Renew' in d and 'Cảnh báo gốc (2)' in d and 'Sáng và tối' in d and 'Chưa đủ thông tin để phân loại: Kem Glow Mystery' in d, d[:300])
        check(f'{tag} chi tiết trong khung hình, không tràn ngang', no_hscroll(pg) and pg.evaluate("document.querySelector('#warnMore .wdet').getBoundingClientRect().right<=window.innerWidth+1"))
        pg.keyboard.press('Space')
        check(f'{tag} Space đóng lại', not det.evaluate('e=>e.open'))
        pg.keyboard.press('Enter')
        # vẽ lại routine (bỏ một sản phẩm) → phần chi tiết vẫn mở, nội dung cập nhật
        pg.click('#warnMore > summary'); pg.click('#warnMore > summary')  # mở lại, rồi thử mở/đóng bằng chuột
        check(f'{tag} chuột mở/đóng được', det.evaluate('e=>e.open'))
        check(f'{tag} không có lỗi JavaScript', errs == [], errs)
        ctx.close()

    # ---------- 2. Cảnh báo thận trọng luôn thấy ở trạng thái thu gọn ----------
    ctx, pg, errs = page(b)
    start(pg, 'A', ['acne'])
    pg.click('#editBox > summary')
    for pid in ['p06', 'p07']:
        pg.select_option('#addSel', pid); pg.click('[data-act=add]')
    pg.wait_for_selector('#routine .wl.g-A')
    a = pg.locator('#routine .wl.g-A').first
    check('Tổ hợp cần thận trọng hiện thành dòng riêng, nổi bật (mức danger), có tên sản phẩm, khi chi tiết còn thu gọn',
          a.is_visible() and 'danger' in a.get_attribute('class') and 'Serum Retinol Renew' in a.inner_text() and 'Gel BHA Clear' in a.inner_text() and not pg.locator('#warnMore').evaluate('e=>e.open'), a.inner_text())
    check('Nhóm A đứng đầu danh sách tóm tắt', pg.evaluate("document.querySelector('#routine .wsum-list li').classList.contains('g-A')"))
    check('Lưu ý in trên nhãn sản phẩm (gây khô/châm chích…) vẫn thấy được: nhãn ngắn ở bước + đầy đủ trong chi tiết',
          pg.locator('#routine li.step .step-warn .tag').filter(has_text='Lưu ý khi dùng').count() + pg.locator('#routine li.step .step-warn .tag').filter(has_text='+').count() >= 1)
    pg.click('#warnMore > summary')
    check('Chi tiết liệt kê lưu ý trên nhãn sản phẩm', 'Lưu ý trên nhãn sản phẩm' in txt(pg, '#warnMore') and 'Có thể gây khô hoặc châm chích' in txt(pg, '#warnMore'))
    # nút dẫn tới khu chỉnh sửa
    pg.click('#editBox > summary')  # đóng
    check('Khu chỉnh sửa đang đóng trước khi bấm đường dẫn', not pg.locator('#editBox').evaluate('e=>e.open'))
    pg.click('[data-act=openedit]'); pg.wait_for_timeout(250)
    check('Nút "Chỉnh sửa sản phẩm" trong tóm tắt mở khu chỉnh sửa và đưa tiêu điểm tới đó',
          pg.locator('#editBox').evaluate('e=>e.open') and pg.evaluate("document.activeElement===document.querySelector('#editBox > summary')") and pg.locator('#editBox').is_visible())
    check('Chi tiết đã mở vẫn giữ trạng thái mở sau khi routine vẽ lại', pg.locator('#warnMore').evaluate('e=>e.open'))

    # ---------- 3. Đổi sản phẩm → nhóm cập nhật ----------
    pg.click('[data-act=rm][data-id=p07]'); pg.wait_for_timeout(150)
    check('Bỏ BHA → dòng thận trọng biến mất (nhóm cập nhật theo Engine)', pg.locator('#routine .wl.g-A').count() == 0)
    ctx.close()

    ctx, pg, errs = page(b)
    start(pg, 'B', ['acne', 'sensitive'])
    before = txt(pg, '#routine .wsum-head')
    for pid in ['p02', 'p09', 'p11']:
        pg.click(f'#editBox:not([open]) > summary') if not pg.locator('#editBox').evaluate('e=>e.open') else None
        pg.click(f'[data-act=rm][data-id={pid}]'); pg.wait_for_timeout(100)
    after = txt(pg, '#routine .wsum')
    check('Bỏ sản phẩm trùng và thiếu dữ liệu → số mục cần xem lại giảm, nhóm Trùng/Dữ liệu biến mất', '6 mục' in before and '6 mục' not in after and 'Trùng hoặc chồng chéo' not in after and 'Kem Glow Mystery' not in after, after)

    # ---------- 4. Chuyển tài khoản ----------
    pg.select_option('#userSel', 'A'); pg.wait_for_timeout(200)
    check('Chuyển sang tài khoản A (chưa có routine) → không còn cảnh báo của B', pg.locator('#routine .wsum').count() == 0 or ('Kem Glow Mystery' not in txt(pg, '#routine') and 'Serum Retinol Renew' not in txt(pg, '#routine .wsum')))
    pg.select_option('#userSel', 'B'); pg.wait_for_timeout(200)
    check('Chuyển lại B → cảnh báo của B (đã bỏ p02/p09/p11) hiển thị đúng, không lẫn người dùng khác', 'Gel dưỡng kiềm dầu Matte' not in txt(pg, '#routine .wsum'))
    check('Chuyển tài khoản: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 5. Đồng bộ với bước Mô hình (thẻ bước dùng chung cho 3D/2D) ----------
    ctx, pg, errs = page(b)
    start(pg, 'B', ['acne', 'sensitive'])
    rows = pg.locator('#routine li.step')
    pg.locator('#routine li.step:has-text("Làm sạch")').first.click()
    pg.wait_for_selector('#info .info-card', timeout=30000)
    info = txt(pg, '#info')
    check('Mô hình: thẻ bước hiện cảnh báo của chính bước đang chọn, cùng thuật ngữ nhóm với trang Routine', 'Trùng / chồng chéo' in info and 'Trùng bước Làm sạch' in info, info[:300])
    check('Mô hình: không lặp lại cảnh báo của cả routine (Retinol, Chống nắng, Kem Glow Mystery, dưỡng ẩm)',
          not any(x in info for x in ['Serum Retinol Renew', 'Chống nắng', 'Kem Glow Mystery', 'Trùng bước Dưỡng ẩm']))
    check('Mô hình: lý do chỉ mở khi cần ("Vì sao?"); thẻ không có nhiều khối đỏ/vàng liên tiếp', pg.locator('#info details.alert').count() == 1 and not pg.locator('#info details.alert p').first.is_visible())
    pg.locator('#info details.alert > summary').first.press('Enter')
    check('Mô hình: mở bằng bàn phím thấy lý do đầy đủ', pg.locator('#info details.alert p').first.is_visible() and 'Bộ quy tắc chỉ xếp 1 sản phẩm' in txt(pg, '#info details.alert'))
    # cảnh báo không che mô hình/bảng sản phẩm: thẻ thông tin nằm ngoài khung mô hình
    st = pg.locator('.stage-wrap').bounding_box(); inf = pg.locator('#info').bounding_box()
    check('Mô hình: cảnh báo nằm trong cột thông tin, không chồng lên khung mô hình', inf['x'] >= st['x'] + st['width'] - 1 or inf['y'] >= st['y'] + st['height'] - 1, f'{st} {inf}')
    check('Mô hình: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 6. Không có cảnh báo: gọn, trung thực ----------
    ctx, pg, errs = page(b)
    start(pg, 'A', ['hydrate'])
    s = txt(pg, '#routine .wsum')
    check('Routine không cảnh báo: không có danh sách nhóm, giữ nguyên lời nhắc "không có nghĩa là đã được xác nhận an toàn"',
          pg.locator('#routine .wsum .wl').count() == 0 and 'Sẵn sàng' in s and 'không có nghĩa là đã được xác nhận an toàn' in s and 'mục cần xem lại' not in s, s)
    check('Không cảnh báo: không có nút chỉnh sửa thừa trong khối tóm tắt', pg.locator('#routine .wsum [data-act=openedit]').count() == 0)
    check('Không cảnh báo: không có lỗi JavaScript', errs == [], errs)
    ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.4.2 đạt.')
