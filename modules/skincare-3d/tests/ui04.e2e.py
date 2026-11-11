# Kiểm thử giao diện 0.4 với 3D THẬT (WebGL) – cần Python + Playwright + Chromium.
#   python -m http.server 8000                    (trong thư mục dự án)
#   python tests/ui04.e2e.py http://localhost:8000          (tải Three.js 0.160.0 từ jsDelivr như ứng dụng thật – cần Internet)
#   python tests/ui04.e2e.py http://localhost:8000 --three-dir=/đường/dẫn/three   (dùng bản Three.js cục bộ, cấu trúc như gói npm:
#        build/three.module.js, examples/jsm/controls/OrbitControls.js – dùng khi môi trường chặn CDN)
# Trang được mở với ?dev để đọc trạng thái viewer (window.__skc). Payload XSS chỉ tăng biến window.__xss.
import sys, os, io, json, datetime
from playwright.sync_api import sync_playwright
from PIL import Image
args = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = (args[0] if args else 'http://localhost:8000')
THREE = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--three-dir=')), None)
BASE = URL if URL.endswith('.html') else URL.rstrip('/') + '/'
DEV = BASE + '?dev'
HERE = os.path.dirname(os.path.abspath(__file__))
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

def page(b, w=1280, h=900, touch=False, init=None, three=True, reduced=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, reduced_motion=reduced or 'no-preference')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if init: pg.add_init_script(init)
    if three: route_three(pg)
    else: pg.route('**/cdn.jsdelivr.net/**', lambda r: r.abort())
    return ctx, pg, errs

# 0.4.1: giao diện chia 3 giai đoạn (Mục tiêu → Routine → Mô hình 3D) + khu "Theo dõi & lịch sử"; nút góc nhìn/thu phóng/chọn vùng
# nằm trong menu "Thêm điều khiển". Chỉ THÊM bước điều hướng (dòng đánh dấu "# 0.4.1 điều hướng"), đổi nơi đọc nội dung đã
# chuyển chỗ (phiên bản → #versions) và đổi bộ chọn của danh sách bước liên quan (#info .rel-steps → #stepPick .pickbtn.rel,
# vì 0.4.1 bỏ danh sách nút bước trùng lặp trong thẻ thông tin). Ngưỡng/điều kiện kiểm tra giữ nguyên.
def stage(pg, s):  # 0.4.1 điều hướng
    pg.click('#trackBtn' if s == 'track' else f'#stepper [data-s={s}]')
def menu(pg):  # 0.4.1 điều hướng: mở "Thêm điều khiển"
    stage(pg, 'model')
    if not pg.evaluate("document.querySelector('#moreCtl').open"): pg.click('#moreCtl > summary')
def edit_box(pg):  # 0.4.1 điều hướng: mở "Chỉnh sửa sản phẩm"
    stage(pg, 'routine')
    if not pg.evaluate("document.querySelector('#editBox').open"): pg.click('#editBox > summary')
REL = '#stepPick .pickbtn.rel'  # 0.4.1: thay '#info .rel-steps button'

def open_feature(pg, clear=True, wait3d=True):
    pg.goto(DEV)
    if clear: pg.evaluate('localStorage.clear()'); pg.reload()
    pg.click('nav [data-v=feature]')
    stage(pg, 'model')  # 0.4.1 điều hướng: 3D chỉ khởi tạo ở bước Mô hình
    if wait3d: pg.wait_for_function('window.__skc && __skc.v3.ready', timeout=30000)
    else: pg.wait_for_function("window.__skc && (!document.querySelector('#v2d').hidden)", timeout=30000)

info = lambda pg: pg.evaluate('__skc.v3.debugInfo()')
def idle(pg, t=15000): pg.wait_for_function('!__skc.v3.debugInfo().rafPending', timeout=t); pg.wait_for_timeout(120)
def zone_pt(pg, z):
    pg.locator('#v3d').scroll_into_view_if_needed(); pg.wait_for_timeout(150)
    return pg.evaluate(f"__skc.v3.projectZone('{z}')")
def pixel(pg, x, y):
    im = Image.open(io.BytesIO(pg.screenshot(clip={'x': x - 2, 'y': y - 2, 'width': 5, 'height': 5}))).convert('RGB')
    px = [im.getpixel((i, j)) for i in range(5) for j in range(5)]
    return tuple(sum(p[k] for p in px) / len(px) for k in range(3))
def quiz(pg, *goals):
    stage(pg, 'goals')  # 0.4.1 điều hướng
    for g in goals: pg.check(f'#quiz input[value={g}]')
    pg.click('[data-act=quiz]')

with sync_playwright() as p:
    b = p.chromium.launch(args=['--js-flags=--expose-gc'])

    # ---------- Test 1–2: xoay ≠ chọn; chọn vùng; highlight trên bề mặt ----------
    ctx, pg, errs = page(b)
    open_feature(pg); idle(pg)
    d0 = info(pg)
    check('3D khởi tạo: 1 canvas, 1 lần init, vòng render nghỉ khi không có thay đổi', d0['canvases'] == 1 and d0['initCount'] == 1 and not d0['rafPending'])
    f = zone_pt(pg, 'forehead'); before = pixel(pg, f['x'], f['y']); c0 = zone_pt(pg, 'cheekL'); cheek0 = pixel(pg, c0['x'], c0['y'])
    pg.mouse.move(f['x'], f['y']); pg.mouse.down(); pg.mouse.move(f['x'] + 160, f['y'] + 10, steps=12); pg.mouse.up(); idle(pg)
    d1 = info(pg)
    check('Test 1: kéo chuột → mô hình xoay (azimuth đổi), KHÔNG chọn vùng', abs(d1['cam']['az'] - d0['cam']['az']) > 0.2 and pg.evaluate('__skc.S.zone') is None and pg.evaluate('__skc.S.step') is None)
    check('Test 1: sau khi xoay xong, vòng render dừng (không vẽ liên tục)', not d1['rafPending'])
    pg.click('[data-act=reset]'); idle(pg)
    check('Đặt lại góc nhìn: về chính diện', abs(info(pg)['cam']['az']) < 0.02)
    f = zone_pt(pg, 'forehead'); pg.mouse.click(f['x'], f['y']); idle(pg)
    after = pixel(pg, f['x'], f['y'])
    check('Test 2: nhấp vào trán → chọn vùng Trán, bảng thông tin cập nhật', pg.evaluate('__skc.S.zone') == 'forehead' and 'Trán' in pg.inner_text('#info') and info(pg)['zones'] == ['forehead'])
    check('Test 2: vùng Trán được tô trên bề mặt (màu chuyển sang xanh nhạt)', (after[1] - after[0]) - (before[1] - before[0]) > 15, f'{before} → {after}')
    check('Test 2: thanh chọn vùng đồng bộ (nút Trán ở trạng thái chọn)', pg.get_attribute('#zonebar [data-z=forehead]', 'aria-pressed') == 'true')
    c = zone_pt(pg, 'cheekL'); cb = pixel(pg, c['x'], c['y'])
    check('Test 2: vùng khác (má trái) không bị tô khi chọn trán', max(abs(cb[k] - cheek0[k]) for k in range(3)) < 6, f'{cheek0} → {cb}')
    pg.mouse.click(c['x'], c['y']); idle(pg)
    check('Quy ước trái/phải: điểm má trái (bên phải màn hình) → vùng "Má trái"', c['x'] > f['x'] and pg.evaluate('__skc.S.zone') == 'cheekL' and 'Má trái' in pg.inner_text('#info'))
    nose = pg.evaluate("(()=>{const a=__skc.v3.projectZone('cheekL'),b=__skc.v3.projectZone('cheekR');return {x:(a.x+b.x)/2,y:a.y-8}})()")
    pg.mouse.click(nose['x'], nose['y']); idle(pg)
    check('Nhấp vào mũi (không phải vùng da) → giữ nguyên lựa chọn', pg.evaluate('__skc.S.zone') == 'cheekL')
    pg.mouse.move(f['x'], f['y']); pg.wait_for_timeout(250)
    check('Rê chuột qua vùng: gợi ý tên vùng, chưa chọn', 'Trán – nhấp để chọn' in pg.inner_text('#stageHint') and pg.evaluate('__skc.S.zone') == 'cheekL')
    check('Test 1–2: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- Cảm ứng: chạm chọn, vuốt xoay, chụm không chọn ----------
    ctx, pg, errs = page(b, 390, 844, touch=True)
    open_feature(pg); idle(pg)
    cdp = ctx.new_cdp_session(pg)
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    c = zone_pt(pg, 'cheekR'); az0 = info(pg)['cam']['az']
    touch('touchStart', [(c['x'], c['y'])])
    for k in range(1, 9): touch('touchMove', [(c['x'] - 14 * k, c['y'])])
    touch('touchEnd', []); idle(pg)
    check('Vuốt bằng ngón tay → xoay mô hình, không chọn vùng', abs(info(pg)['cam']['az'] - az0) > 0.15 and pg.evaluate('__skc.S.zone') is None)
    menu(pg)  # 0.4.1 điều hướng
    pg.click('[data-act=preset][data-p=front]'); idle(pg)
    c = zone_pt(pg, 'cheekR')
    touch('touchStart', [(c['x'] - 30, c['y']), (c['x'] + 30, c['y'])]); touch('touchMove', [(c['x'] - 40, c['y']), (c['x'] + 40, c['y'])]); touch('touchEnd', []); idle(pg)
    check('Chụm/mở hai ngón → không chọn vùng', pg.evaluate('__skc.S.zone') is None)
    c = zone_pt(pg, 'cheekR'); touch('touchStart', [(c['x'], c['y'])]); touch('touchEnd', []); idle(pg)
    check('Chạm vào má phải → chọn "Má phải" (cảm ứng)', pg.evaluate('__skc.S.zone') == 'cheekR' and 'Má phải' in pg.inner_text('#info'))
    check('Cảm ứng: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- Test 3–4: chọn bước, thay/bỏ sản phẩm ----------
    ctx, pg, errs = page(b)
    open_feature(pg); quiz(pg, 'acne', 'hydrate')
    edit_box(pg)  # 0.4.1 điều hướng
    pg.select_option('#addSel', 'p07'); pg.click('[data-act=add]')
    pg.click('#routine li.step[data-id="pm:treat"]'); idle(pg)
    z = sorted(info(pg)['zones'])
    check('Test 3: chọn bước BHA (pm:treat) → highlight đúng vùng khai báo: trán + cằm', z == ['chin', 'forehead'] and pg.evaluate('__skc.S.step') == 'pm:treat')
    it = pg.inner_text('#info')
    check('Test 3: bảng giải thích: sản phẩm, vùng, cảnh báo của bước', 'Gel BHA Clear' in it and 'Trán, Cằm' in it and 'Có thể gây khô' in it)
    check('Test 3: thẻ bước được đánh dấu "Đang chọn"; bộ chọn bước trong studio đồng bộ', pg.locator('#routine li.step.sel').count() == 1 and pg.get_attribute('#stepPick [data-id="pm:treat"]', 'aria-pressed') == 'true')
    stage(pg, 'routine')  # 0.4.1 điều hướng
    pg.click('#routine li.step[data-id="am:cleanse"]'); idle(pg)
    check('Test 3: bước "toàn mặt" → phủ toàn mặt + 4 vùng (không bỏ qua highlight)', info(pg)['zones'][0] == 'face' and len(info(pg)['zones']) == 5 and 'toàn khuôn mặt' in pg.inner_text('#info'))
    stage(pg, 'routine')  # 0.4.1 điều hướng
    pg.click('#routine li.step[data-id="pm:treat"]')
    w_before = pg.inner_text('#routine')
    edit_box(pg)  # 0.4.1 điều hướng
    pg.select_option('#routine select[data-act=rep][data-id=p07]', 'p06'); idle(pg)
    check('Test 4: thay BHA bằng Retinol → bước vẫn được chọn, vùng cập nhật (trán + hai má), thông tin cập nhật', sorted(info(pg)['zones']) == ['cheekL', 'cheekR', 'forehead'] and 'Serum Retinol Renew' in pg.inner_text('#info') and 'Gel BHA Clear' not in pg.inner_text('#info'))
    w_after = pg.inner_text('#routine')
    check('Test 4: cảnh báo/lưu ý được tính lại theo sản phẩm mới', 'Có thể gây khô hoặc châm chích' in w_before and 'Có thể gây khô hoặc châm chích' not in w_after and 'Nên bắt đầu với tần suất thấp' in w_after)
    pg.click('#routine [data-act=rm][data-id=p06]'); idle(pg)
    check('Test 4: bỏ sản phẩm → bước đang chọn biến mất → tự bỏ chọn, có thông báo, mô hình hết highlight', pg.evaluate('__skc.S.step') is None and 'không còn trong routine' in pg.inner_text('#info') and info(pg)['zones'] == [])
    menu(pg)  # 0.4.1 điều hướng
    pg.click('#zonebar [data-z=chin]'); idle(pg)
    check('Chọn vùng từ thanh vùng da → các bước liên quan được đánh dấu trong routine', pg.locator('#routine li.step.rel').count() >= 4 and pg.locator(REL).count() >= 4)
    pg.locator(REL).first.click(); idle(pg)
    # 0.4.1: thẻ bước không còn tiêu đề 'Sản phẩm trong bước'; thẻ chi tiết bước có dòng 'Vùng thoa'
    check('Từ danh sách bước của vùng → mở chi tiết bước', pg.evaluate('__skc.S.step') is not None and 'Vùng thoa' in pg.inner_text('#info'))
    check('Test 3–4: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- Test 5 + 10: chuyển chế độ nhiều lần, tài nguyên ổn định ----------
    ctx, pg, errs = page(b)
    open_feature(pg); quiz(pg, 'hydrate'); pg.click('#routine li.step[data-id="am:toner"]'); idle(pg)
    g0 = info(pg); pg.evaluate('gc()'); heap0 = pg.evaluate('performance.memory.usedJSHeapSize')
    for i in range(8):
        pg.click('[data-act=mode][data-m="2d"]'); pg.wait_for_timeout(60)
        if i == 0: check('Test 5: ở 2D vòng render 3D dừng hẳn', not info(pg)['rafPending'] and info(pg)['paused'])
        pg.click('[data-act=mode][data-m="3d"]'); idle(pg)
    g1 = info(pg); pg.evaluate('gc()'); heap1 = pg.evaluate('performance.memory.usedJSHeapSize')
    check('Test 5: 3D↔2D ×8 → vẫn 1 canvas, 1 lần khởi tạo, không còn vòng render chờ', g1['canvases'] == 1 and g1['initCount'] == 1 and not g1['rafPending'] and pg.locator('canvas').count() == 1)
    check('Test 5: lựa chọn giữ nguyên qua các lần chuyển; 2D hiển thị cùng vùng', pg.evaluate('__skc.S.step') == 'am:toner' and len(g1['zones']) == 5)
    check('Test 10: số geometry/material/texture không tăng sau 8 lần chuyển', (g1['geometries'], g1['materials'], g1['gpu']['geometries'], g1['gpu']['textures']) == (g0['geometries'], g0['materials'], g0['gpu']['geometries'], g0['gpu']['textures']))
    check('Test 10: bộ nhớ JS không tăng bất thường (< 4 MB sau GC)', heap1 - heap0 < 4 * 2**20, f'{(heap1 - heap0) / 2**20:.2f} MB')
    pg.click('[data-act=mode][data-m="2d"]')
    check('2D giữ lựa chọn: bước toàn mặt → 4 vùng + phủ toàn mặt', pg.locator('#v2d .zone.on').count() == 4 and pg.locator('#v2d .face-ov.on').count() == 1)
    pg.click('#v2d [data-z=chin]')
    check('2D: chọn cằm → đồng bộ thông tin + thanh vùng', pg.evaluate('__skc.S.zone') == 'chin' and 'Cằm' in pg.inner_text('#info') and pg.get_attribute('#zonebar [data-z=chin]', 'aria-pressed') == 'true')
    pg.focus('#v2d [data-z=forehead]'); pg.keyboard.press('Enter')
    check('2D: chọn vùng bằng bàn phím (Tab + Enter)', pg.evaluate('__skc.S.zone') == 'forehead')
    pg.click('[data-act=mode][data-m="3d"]'); idle(pg)
    check('Quay lại 3D: highlight vùng đã chọn ở 2D', info(pg)['zones'] == ['forehead'])
    # chuyển trang Cửa hàng ↔ tính năng; tab ẩn ↔ hiện
    pg.click('nav [data-v=home]'); pg.wait_for_timeout(100)
    check('Chuyển sang trang Cửa hàng: 3D tạm dừng', info(pg)['paused'] and not info(pg)['rafPending'])
    pg.click('nav [data-v=feature]'); idle(pg)
    fr = info(pg)['frames']
    pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));__skc.v3.zoom(0.9);0")
    pg.wait_for_timeout(400)
    check('Tab bị ẩn: không render khung nào dù có yêu cầu', info(pg)['frames'] == fr and not info(pg)['rafPending'])
    pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));0"); idle(pg)
    check('Tab hiện lại: render tiếp, rồi nghỉ', info(pg)['frames'] > fr and not info(pg)['rafPending'])
    # resize
    pg.set_viewport_size({'width': 820, 'height': 900}); pg.wait_for_timeout(300); idle(pg)
    d = info(pg); box = pg.locator('#v3d').bounding_box()
    check('Đổi kích thước cửa sổ → renderer khớp khung chứa, khoảng cách camera trong giới hạn', d['size'] == [round(box['width']), round(box['height'])] and d['limits']['min'] <= d['cam']['dist'] <= d['limits']['max'])
    menu(pg)  # 0.4.1 điều hướng
    for _ in range(12): pg.click('[data-act=zoom][data-f="0.85"]')
    idle(pg); d = info(pg)
    check('Phóng to tối đa: camera không vào trong mô hình (≥ giới hạn tối thiểu)', d['cam']['dist'] >= d['limits']['min'] - 1e-6 and d['cam']['dist'] > 2.2)
    for _ in range(20): pg.click('[data-act=zoom][data-f="1.18"]')
    idle(pg); d = info(pg)
    check('Thu nhỏ tối đa: mô hình không biến mất (≤ giới hạn tối đa)', d['cam']['dist'] <= d['limits']['max'] + 1e-6)
    pg.click('[data-act=preset][data-p=left]'); idle(pg); azl = info(pg)['cam']['az']
    pg.click('[data-act=preset][data-p=right]'); idle(pg); azr = info(pg)['cam']['az']
    check('Nút góc nhìn thực sự điều khiển camera (má trái: +x, má phải: −x)', azl > 1.0 and azr < -1.0)
    pg.click('nav [data-v=home]'); pg.click('nav [data-v=feature]'); pg.click('#perfBtn'); pg.wait_for_timeout(700)  # 0.4.1: nút hiệu năng nằm trong thanh Developer của trang tính năng
    check('Chế độ hiệu năng (dev): tắt mặc định, bật thì hiện số liệu thật', not pg.is_hidden('#perf') and 'Draw calls' in pg.inner_text('#perf') and 'Tam giác' in pg.inner_text('#perf'))
    check('Test 5/10: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    ctx, pg, errs = page(b, reduced='reduce')
    open_feature(pg); idle(pg)
    menu(pg)  # 0.4.1 điều hướng
    pg.click('[data-act=preset][data-p=left]')
    check('prefers-reduced-motion: camera chuyển góc tức thì (không tween)', abs(info(pg)['cam']['az'] - 1.12) < 0.02 and info(pg)['reduced'])
    ctx.close()

    # ---------- Test 6: lỗi 3D ----------
    ctx, pg, errs = page(b)
    open_feature(pg); quiz(pg, 'hydrate'); pg.click('#routine li.step[data-id="am:serum"]'); idle(pg)
    n0 = info(pg)['initCount']
    pg.click('#simBtn'); pg.wait_for_function("!document.querySelector('#v2d').hidden", timeout=10000)
    d = info(pg)
    check('Test 6: lỗi giả lập khi đang chạy → thông báo, chuyển 2D, viewer 3D được giải phóng', 'lỗi 3D giả lập khi đang chạy' in pg.inner_text('#notice') and not d['ready'] and d['canvases'] == 0 and pg.locator('canvas').count() == 0)
    check('Test 6: giữ bước đang chọn; 2D hiển thị vùng của bước', pg.evaluate('__skc.S.step') == 'am:serum' and pg.locator('#v2d .zone.on').count() == 4)
    pg.click('[data-act=mode][data-m="3d"]'); pg.wait_for_timeout(200)
    check('Test 6: còn bật giả lập → bấm 3D vẫn lỗi ở bước khởi tạo, không màn hình trắng', 'ở bước khởi tạo' in pg.inner_text('#notice') and not pg.is_hidden('#v2d'))
    pg.click('#simBtn'); pg.click('[data-act=mode][data-m="3d"]'); pg.wait_for_function('__skc.v3.ready', timeout=20000); idle(pg)
    d = info(pg)
    check('Khởi tạo lại sau dispose: 1 canvas mới, highlight khôi phục', d['canvases'] == 1 and d['initCount'] == n0 + 1 and len(d['zones']) == 5 and pg.locator('canvas').count() == 1)
    for k in range(3):
        pg.click('#simBtn'); pg.wait_for_function("!document.querySelector('#v2d').hidden", timeout=10000)
        pg.click('#simBtn'); pg.click('[data-act=mode][data-m="3d"]'); pg.wait_for_function('__skc.v3.ready', timeout=20000); idle(pg)
    d = info(pg)
    check('Lỗi → khởi tạo lại ×3: không dồn canvas, tài nguyên như ban đầu', d['canvases'] == 1 and pg.locator('canvas').count() == 1 and d['geometries'] == g0['geometries'] and d['gpu']['geometries'] == g0['gpu']['geometries'])
    stage(pg, 'routine')  # 0.4.1 điều hướng
    pg.click('[data-act=save]')
    check('Test 6: các chức năng khác vẫn chạy (lưu routine)', 'Đã lưu v1' in pg.inner_text('#routine'))
    check('Test 6: không có lỗi JavaScript', errs == [], errs)
    ctx.close()
    ctx, pg, errs = page(b, init="const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:g.call(this,t,...a)}")
    open_feature(pg, wait3d=False)
    check('Không hỗ trợ WebGL → báo rõ nguyên nhân, dùng 2D, trang không lỗi', 'không hỗ trợ WebGL' in pg.inner_text('#notice') and not pg.is_hidden('#v2d') and errs == [])
    ctx.close()
    ctx, pg, errs = page(b, three=False)
    open_feature(pg, wait3d=False)
    check('Không tải được Three.js (mất mạng/CDN bị chặn) → báo rõ, dùng 2D', 'không tải được thư viện 3D' in pg.inner_text('#notice') and not pg.is_hidden('#v2d') and errs == [])
    pg.click('#v2d [data-z=cheekL]')
    check('Chế độ dự phòng 2D vẫn chọn vùng được', pg.evaluate('__skc.S.zone') == 'cheekL')
    ctx.close()

    # ---------- Test 7: responsive ----------
    for W, H in [(1440, 900), (1024, 768), (768, 1024), (390, 844)]:
        ctx, pg, errs = page(b, W, H, touch=W < 800)
        pg.goto(DEV); pg.evaluate('localStorage.clear()'); pg.reload()
        sw_home = pg.evaluate('document.documentElement.scrollWidth')
        pg.click('nav [data-v=feature]')
        quiz(pg, 'hydrate'); pg.locator('#routine li.step').first.click(); pg.wait_for_function('__skc.v3.ready', timeout=30000); idle(pg)  # 0.4.1: 3D khởi tạo khi vào bước Mô hình
        sw = pg.evaluate('document.documentElement.scrollWidth'); st = pg.locator('#v3d').bounding_box(); inf = pg.locator('#info').bounding_box()
        sep = inf['y'] >= st['y'] + st['height'] or inf['x'] >= st['x'] + st['width']
        btns = pg.eval_on_selector_all('#viewerCard .toolbar button:not([hidden]), #zonebar button', 'e=>e.filter(x=>x.offsetParent).map(x=>x.getBoundingClientRect().height)')
        d = info(pg)
        check(f'Test 7 [{W}px]: không cuộn ngang; mô hình đủ lớn và không bị che; nút đủ lớn để chạm',
              sw_home <= W and sw <= W and st['width'] >= min(320, W - 60) and st['height'] >= 320 and sep and min(btns) >= 32 and d['size'] == [round(st['width']), round(st['height'])],
              f'sw={sw} stage={st} info={inf} btns={min(btns)}')
        check(f'Test 7 [{W}px]: không có lỗi JavaScript', errs == [], errs)
        ctx.close()

    # ---------- Test 8: dữ liệu localStorage do 0.3.1 tạo ----------
    fx = json.load(open(os.path.join(HERE, 'fixtures', 'data-0.3.1.json'), encoding='utf-8'))['localStorage']
    A = json.loads(fx['skc:A'])
    ctx, pg, errs = page(b)
    pg.goto(DEV); pg.evaluate('d=>{localStorage.clear();for(const [k,v] of Object.entries(d))localStorage.setItem(k,v)}', fx); pg.reload()
    pg.click('nav [data-v=feature]'); stage(pg, 'model'); pg.wait_for_function('__skc.v3.ready', timeout=30000)  # 0.4.1 điều hướng
    check('Test 8: nhớ tài khoản đang chọn từ 0.3.1 (skc:uid)', pg.input_value('#userSel') == fx['skc:uid'])
    pg.select_option('#userSel', 'A')
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    r, tl, jn = pg.inner_text('#routine') + pg.inner_text('#versions'), pg.inner_text('#timeline'), pg.inner_text('#journal')  # 0.4.1: phiên bản ở #versions
    check('Test 8: đọc dữ liệu 0.3.1: đủ phiên bản, ghi chú hiển thị dạng chữ, không có thông báo chuyển đổi', pg.locator('[data-act=restore]').count() == len(A['versions']) and 'bản đầu <b>đậm?</b>' in r and 'chuyển đổi' not in r)
    check('Test 8: lịch sử áp dụng + bản ghi sửa ngày + ngày bắt đầu theo dõi giữ nguyên (0.4.3: lịch sử nằm ở tab Phiên bản)', f"Lịch sử áp dụng ({len(A['applications'])})" in r and 'đã sửa ngày áp dụng' in r and pg.input_value('#startDate') == A['startDate'] and 'bắt đầu sớm hơn & "thử"' in r)
    check('Test 8: nhật ký 0.3.1 hiển thị đúng (ký tự HTML là chữ)', pg.locator('#journal table tr').count() == len(A['journal']) + 1 and '<i>da hơi khô</i> & ổn' in jn)
    check('Test 8: mở bằng 0.4 không ghi lại dữ liệu', pg.evaluate("localStorage.getItem('skc:A')") == fx['skc:A'] and pg.evaluate("localStorage.getItem('skc:B')") == fx['skc:B'])
    pg.select_option('#userSel', 'B')
    check('Test 8: tài nguyên tách theo tài khoản (User B có 1 phiên bản riêng)', pg.locator('[data-act=restore]').count() == len(json.loads(fx['skc:B'])['versions']))
    check('Test 8: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- Test 9: XSS trong giao diện mới ----------
    X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">'
    seed = json.loads(fx['skc:A']); seed['versions'][0]['note'] = X; seed['selection'].append(X); seed['quiz']['goals'].append(X)
    seed['journal'][X] = {'dry': X, 'oil': 1, 'irr': 1, 'note': X}
    ctx, pg, errs = page(b)
    pg.goto(DEV); pg.evaluate('d=>{localStorage.clear();localStorage.setItem("skc:A",JSON.stringify(d))}', seed); pg.reload()
    pg.click('nav [data-v=feature]'); stage(pg, 'model'); pg.wait_for_function('__skc.v3.ready', timeout=30000)  # 0.4.1 điều hướng
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    pg.click('#zonebar [data-z=forehead]'); pg.locator(REL).first.click(); idle(pg)
    on_attrs = pg.evaluate("[...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>/^on/i.test(a.name))).length")
    check('Test 9: dữ liệu chứa HTML/JS không được thực thi, không tạo thuộc tính on*, hiển thị thành chữ', pg.evaluate('window.__xss') is None and on_attrs == 0 and X in pg.inner_text('#routine') and X in pg.inner_text('#journal'))
    check('Test 9: không có lỗi JavaScript', errs == [], errs)
    ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.4 đạt.')
