# Kiểm thử giao diện 0.4.1 – luồng 3 giai đoạn và việc ẩn/hiện các khu vực (cần Python + Playwright + Chromium).
#   python -m http.server 8000                                   (trong thư mục dự án)
#   python tests/ui041.e2e.py http://localhost:8000                (tải Three.js 0.160.0 từ jsDelivr – cần Internet)
#   python tests/ui041.e2e.py http://localhost:8000 --three-dir=/đường/dẫn/three   (Three.js cục bộ, cấu trúc như gói npm)
#   Đặt biến môi trường SHOTS=<thư mục> để lưu ảnh chụp giao diện ở từng kích thước màn hình.
# Luồng chính được kiểm tra như một khách hàng: Mở tính năng → Chọn mục tiêu → Tạo routine → Xem routine → Mở mô hình 3D
# → Chọn bước → Xem giải thích. Phần lớn chạy KHÔNG có ?dev (giao diện người dùng thật); chỉ phần đọc trạng thái viewer dùng ?dev.
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

VISIBLE_STAGES = "[...document.querySelectorAll('#feature [data-stage]')].filter(e=>!e.hidden).map(e=>e.dataset.stage)"
# nút chính (primary) đang thực sự hiển thị (không nằm trong phần thu gọn / khu bị ẩn)
PRIMARY = "[...document.querySelectorAll('#feature button.primary')].filter(b=>b.getClientRects().length&&b.offsetParent).map(b=>b.textContent.trim())"
RES = lambda pg, part: pg.evaluate(f"performance.getEntriesByType('resource').filter(r=>r.name.includes('{part}')).length")
vis = lambda pg, sel: pg.locator(sel).first.is_visible()
def no_hscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth')

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 1. Luồng khách hàng (không có ?dev) ----------
    ctx, pg, errs = page(b)
    pg.goto(BASE); pg.evaluate('localStorage.clear()'); pg.reload()
    check('Trang chủ có một lời mời rõ ràng vào tính năng', pg.locator('#home button.primary').count() == 1)
    pg.click('#home button.primary')
    check('Mở tính năng → chỉ hiện giai đoạn "Mục tiêu"', pg.evaluate(VISIBLE_STAGES) == ['goals'] and vis(pg, '#goalsTitle'))
    check('Chưa vào bước Mô hình: KHÔNG tải Three.js / mô hình, không có canvas', RES(pg, 'three') == 0 and RES(pg, 'head.glb') == 0 and pg.locator('canvas').count() == 0)
    check('Mục tiêu: bảng phân tích kỹ thuật thu gọn mặc định; có danh sách sản phẩm đã mua', not pg.evaluate("document.querySelector('#analysisBox').open") and not vis(pg, '#analysis table') and pg.locator('#quiz .owned-list li').count() == 6)
    check('Mục tiêu: đúng MỘT nút chính', pg.evaluate(PRIMARY) == ['Tạo routine của tôi'], pg.evaluate(PRIMARY))
    check('Công cụ developer ẩn mặc định (giả lập lỗi, hiệu năng)', not vis(pg, '#devbar') and not vis(pg, '#simBtn') and not vis(pg, '#perfBtn') and not vis(pg, '#perf'))
    pg.click('[data-act=quiz]')
    check('Bấm tạo routine khi chưa chọn mục tiêu → nhắc rõ, vẫn ở bước 1', 'chọn ít nhất một mục tiêu' in pg.inner_text('#quiz') and pg.evaluate(VISIBLE_STAGES) == ['goals'])
    pg.click('#quiz label.opt:has(input[value=hydrate])')
    pg.click('[data-act=quiz]')
    check('Chọn mục tiêu → Tạo routine → chuyển sang "Routine"', pg.evaluate(VISIBLE_STAGES) == ['routine'] and 'Routine của bạn' in pg.inner_text('#routine'))
    am, pm = pg.locator('#routine .period.am li.step'), pg.locator('#routine .period.pm li.step')
    check('Routine: hiện thứ tự bước sáng/tối, tên sản phẩm, mục đích', am.count() >= 3 and pm.count() >= 3 and vis(pg, '#routine .period.am .step-prod') and vis(pg, '#routine .period.am .step-purpose'))
    check('Routine: thông tin nâng cao nằm trong phần mở rộng (đóng mặc định)', pg.locator('#routine details.more').count() == 3 and pg.evaluate("[...document.querySelectorAll('#routine details.more')].every(d=>!d.open)") and not vis(pg, '#routine .excl, #routine .goals'))
    check('Routine: đúng MỘT nút chính ("Xem trên mô hình 3D"), một nút Lưu', pg.evaluate(PRIMARY) == ['Xem trên mô hình 3D'] and pg.locator('[data-act=save]').count() == 1, pg.evaluate(PRIMARY))
    check('Thanh 3 bước: bước 1 đã xong, bước 2 đang xem', pg.locator('#stepper li').count() == 3 and 'done' in pg.get_attribute('#stepper li >> nth=0', 'class') and pg.get_attribute('#stepper [data-s=routine]', 'aria-current') == 'step')
    pg.click('#routine button.primary')
    pg.wait_for_selector('#v3d canvas', timeout=30000)
    check('Mở mô hình 3D → giai đoạn "Mô hình 3D"; 3D tải lúc này', pg.evaluate(VISIBLE_STAGES) == ['model'] and RES(pg, 'head.glb') == 1 and pg.locator('canvas').count() == 1)
    check('Mô hình: điều khiển mặc định chỉ gồm 3D/2D + Đặt lại góc nhìn; góc nghiêng/thu phóng/chọn vùng nằm trong menu đóng',
          vis(pg, '[data-act=mode][data-m="3d"]') and vis(pg, '[data-act=mode][data-m="2d"]') and vis(pg, '[data-act=reset]')
          and not vis(pg, '[data-act=preset]') and not vis(pg, '[data-act=zoom]') and not vis(pg, '#zonebar'))
    check('Mô hình: chưa chọn bước → lời nhắc ngắn, không có nút chính thừa', 'Chọn một bước' in pg.inner_text('#info') and pg.evaluate(PRIMARY) == [])
    steps = pg.locator('#stepPick .pickbtn')
    check('Mô hình: danh sách bước duy nhất (không lặp ở nơi khác trong màn hình)', steps.count() == am.count() + pm.count() and pg.locator('#info button[data-act=step]').count() == 0)
    steps.nth(1).click()
    it = pg.inner_text('#info')
    check('Chọn bước → thẻ giải thích: tên bước, sản phẩm, mục đích, vùng thoa', 'Toner' in it and 'Toner cấp ẩm Dew' in it and 'Vùng thoa' in it and pg.get_attribute('#stepPick .pickbtn >> nth=1', 'aria-pressed') == 'true')
    check('Thông tin chi tiết chỉ hiện khi cần ("Xem chi tiết" đóng mặc định)', not pg.evaluate("document.querySelector('#infoMore').open") and not vis(pg, '#infoMore .prodline'))
    pg.click('#infoMore > summary')
    check('Mở "Xem chi tiết" → cách dùng sản phẩm', vis(pg, '#infoMore .prodline') and 'Cách dùng' in pg.inner_text('#infoMore'))
    pg.click('#moreCtl > summary')
    st = pg.locator('#v3d').bounding_box(); mb = pg.locator('#moreCtl .menu-body').bounding_box()
    check('Mở "Thêm điều khiển": hiện góc nghiêng, thu phóng, chọn vùng – và KHÔNG che mô hình',
          vis(pg, '[data-act=preset][data-p=left]') and vis(pg, '[data-act=zoom]') and vis(pg, '#zonebar [data-z=chin]') and mb['y'] + mb['height'] <= st['y'] + 1, f'menu={mb} stage={st}')
    pg.click('#zonebar [data-z=forehead]')
    check('Chọn vùng Trán → thẻ thông tin vùng; các bước liên quan được đánh dấu trong danh sách bước', 'Trán' in pg.inner_text('#info') and pg.locator('#stepPick .pickbtn.rel').count() >= 4)
    check('Luồng chính: không có lỗi JavaScript', errs == [], errs)

    # ---------- 2. Khu "Theo dõi & lịch sử" ----------
    pg.click('#trackBtn')
    check('Theo dõi & lịch sử: tách khỏi 3 bước chính; mặc định tab Nhật ký', pg.evaluate(VISIBLE_STAGES) == ['track'] and vis(pg, '#journal') and not vis(pg, '#timeline') and not vis(pg, '#versions'))
    for t in ['timeline', 'versions', 'journal']:
        pg.click(f'[data-act=tab][data-t={t}]')
        shown = [x for x in ['journal', 'timeline', 'versions'] if vis(pg, '#' + x)]
        check(f'Tab "{t}": chỉ khu này hiện, nút tab ở trạng thái chọn', shown == [t] and pg.get_attribute(f'[data-act=tab][data-t={t}]', 'aria-selected') == 'true')
    pg.click('[data-act=tab][data-t=versions]')
    check('Phiên bản: chưa lưu → thông báo rõ', 'Chưa có phiên bản nào' in pg.inner_text('#versions'))
    pg.click('#stepper [data-s=routine]'); pg.click('[data-act=save]')
    check('Lưu routine ở bước 2 → báo đã lưu', 'Đã lưu v1' in pg.inner_text('#routine'))
    pg.click('#trackBtn'); pg.click('[data-act=tab][data-t=versions]')
    pg.click('details.ver > summary'); pg.click('[data-act=restore]')
    check('Khôi phục từ tab Phiên bản → quay về bước Routine, có thông báo', pg.evaluate(VISIBLE_STAGES) == ['routine'] and 'Đã khôi phục v1' in pg.inner_text('#routine'))
    pg.click('#trackBtn'); pg.click('[data-act=tab][data-t=timeline]')
    check('Timeline vẫn hoạt động (đang áp dụng v1)', 'Routine đang áp dụng' in pg.inner_text('#timeline') and 'v1' in pg.inner_text('#timeline'))
    pg.click('[data-act=tab][data-t=journal]'); pg.fill('#jnote', 'da ổn'); pg.click('[data-act=jsave]')
    check('Nhật ký vẫn lưu được', 'Đã ghi nhật ký' in pg.inner_text('#journal') and pg.locator('#journal table tr').count() == 2)

    # ---------- 3. Developer mode ----------
    pg.click('#devBtn')
    check('Developer mode (chân trang) → hiện công cụ dev, vẫn đủ chức năng', vis(pg, '#devbar') and vis(pg, '#simBtn') and vis(pg, '#perfBtn') and pg.get_attribute('#devBtn', 'aria-pressed') == 'true')
    pg.click('#stepper [data-s=model]'); pg.click('#perfBtn'); pg.wait_for_timeout(300)
    check('Dev: bật hiệu năng → hiện số liệu chẩn đoán', vis(pg, '#perf') and 'Draw calls' in pg.inner_text('#perf'))
    pg.click('#devBtn')
    check('Tắt developer mode → ẩn thanh dev và bảng hiệu năng', not vis(pg, '#devbar') and not vis(pg, '#perf'))
    pg.click('#stepper [data-s=routine]'); pg.click('#editBox > summary')
    first = pg.locator('#editBox .sel-list li').count()
    pg.click('#editBox [data-act=rm] >> nth=0')
    check('Phần mở rộng giữ trạng thái mở sau khi routine vẽ lại (Chỉnh sửa sản phẩm)', pg.evaluate("document.querySelector('#editBox').open") and pg.locator('#editBox .sel-list li').count() == first - 1)
    check('Điều hướng + ẩn/hiện: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 4. Cảnh báo quan trọng vẫn nhận biết được ở trạng thái thu gọn (0.4.2 thay cho "mỗi cảnh báo một thẻ ngoài phần mở rộng") ----------
    ctx, pg, errs = page(b)
    pg.goto(BASE); pg.evaluate('localStorage.clear();localStorage.setItem("skc:uid","B")'); pg.reload()
    pg.click('nav [data-v=feature]')
    for g in ['acne']: pg.click(f'#quiz label.opt:has(input[value={g}])')  # B + mụn: có tổ hợp BHA + Retinol (thận trọng)
    pg.click('[data-act=quiz]')
    n_imp = pg.evaluate("[...document.querySelectorAll('#routine .wsum .wl')].filter(e=>e.offsetParent).length")
    lv = pg.eval_on_selector_all('#routine .wsum .wl', 'e=>e.map(x=>x.className)')
    check('Cảnh báo quan trọng hiển thị ngay dưới dạng dòng tóm tắt, ngoài các phần thu gọn', n_imp >= 1 and all(('danger' in c) or ('warn' in c) or ('neutral' in c) for c in lv), lv)
    check('Dòng tóm tắt nêu tên sản phẩm; lý do đầy đủ nằm trong "Xem giải thích chi tiết" (đóng mặc định)', pg.locator('#routine .wsum .wl').first.is_visible() and not pg.locator('#warnMore .wdet').first.is_visible())
    pg.click('#warnMore > summary')
    check('Mở chi tiết → thấy lý do', pg.locator('#warnMore .wdet').is_visible() and 'Cảnh báo gốc' in pg.inner_text('#warnMore'))
    pw = pg.locator('#routine li.step .step-warn')
    check('Lưu ý của sản phẩm/bước hiện ngay trong dòng bước dưới dạng nhãn ngắn', pw.count() >= 1 and pw.first.locator('.tag').is_visible())
    pg.locator('#routine li.step:has(.step-warn)').first.click(); pg.wait_for_timeout(300)
    check('Lưu ý của bước cũng hiện ngay trên thẻ giải thích ở bước 3', vis(pg, '#info .info-card > .warns .alert') or vis(pg, '#info .info-card > .alert'))
    check('Cảnh báo: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 5. ?dev chỉ dành cho kiểm thử: bật sẵn thanh dev ----------
    ctx, pg, errs = page(b)
    pg.goto(BASE + '?dev'); pg.click('nav [data-v=feature]')
    check('?dev → developer mode bật sẵn', vis(pg, '#devbar'))
    pg.click('#stepper [data-s=model]'); pg.wait_for_function('window.__skc && __skc.v3.ready', timeout=30000)
    pg.click('#stepper [data-s=routine]'); pg.wait_for_timeout(200)
    d = pg.evaluate('__skc.v3.debugInfo()')
    check('Rời bước Mô hình → 3D dừng render', d['paused'] and not d['rafPending'])
    pg.click('#stepper [data-s=model]'); pg.wait_for_timeout(400)
    d = pg.evaluate('__skc.v3.debugInfo()')
    check('Quay lại bước Mô hình → dùng lại viewer cũ (không khởi tạo lại, 1 canvas)', d['initCount'] == 1 and d['canvases'] == 1 and not d['paused'])
    ctx.close()

    # ---------- 6. Bố cục: desktop / tablet / mobile ----------
    for W, H, touch in [(1440, 900, False), (1024, 768, False), (768, 1024, True), (390, 844, True), (360, 740, True)]:
        ctx, pg, errs = page(b, W, H, touch)
        pg.goto(BASE); pg.evaluate('localStorage.clear()'); pg.reload()
        hs = [no_hscroll(pg)]
        pg.click('nav [data-v=feature]'); hs.append(no_hscroll(pg))
        pg.click('#quiz label.opt:has(input[value=hydrate])'); pg.click('[data-act=quiz]'); hs.append(no_hscroll(pg))
        pg.locator('#routine li.step').first.click(); pg.wait_for_selector('#v3d canvas', timeout=30000); pg.wait_for_timeout(300); hs.append(no_hscroll(pg))
        st = pg.locator('#v3d').bounding_box(); inf = pg.locator('#info').bounding_box(); tb = pg.locator('#viewerCard .toolbar').bounding_box()
        beside = inf['x'] >= st['x'] + st['width'] - 1; below = inf['y'] >= st['y'] + st['height'] - 1
        layout_ok = beside if W >= 1024 else below
        check(f'[{W}px] không cuộn ngang ở cả 4 màn hình', all(hs), hs)
        check(f'[{W}px] mô hình lớn; {"thông tin bên cạnh" if W >= 1024 else "mô hình trước, thông tin bên dưới"}; thanh điều khiển không đè lên mô hình',
              layout_ok and st['width'] >= min(330, W - 40) and st['height'] >= 320 and tb['y'] + tb['height'] <= st['y'] + 1, f'stage={st} info={inf} tb={tb}')
        if touch:
            hts = pg.eval_on_selector_all('#stepper button, #stepPick .pickbtn, [data-act=mode], [data-act=reset], #moreCtl > summary, #stage-model button.primary',
                                          'e=>e.filter(x=>x.offsetParent).map(x=>Math.round(x.getBoundingClientRect().height))')
            check(f'[{W}px] vùng chạm đủ lớn (≥ 34 px) cho các nút chính trên màn hình mô hình', min(hts) >= 34, hts)
        if os.environ.get('SHOTS'):
            out = os.environ['SHOTS']; os.makedirs(out, exist_ok=True)
            pg.locator('#stepPick .pickbtn').nth(1).click(); pg.wait_for_timeout(600)
            pg.screenshot(path=os.path.join(out, f'ui-{W}-model.png'), full_page=True)
            pg.click('#stepper [data-s=routine]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(out, f'ui-{W}-routine.png'), full_page=True)
            pg.click('#stepper [data-s=goals]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(out, f'ui-{W}-goals.png'), full_page=True)
            pg.click('#trackBtn'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(out, f'ui-{W}-track.png'), full_page=True)
        check(f'[{W}px] không có lỗi JavaScript', errs == [], errs)
        ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.4.1 đạt.')
