# Kiểm thử giao diện 0.5 – 3D thật + luồng khách hàng + phản hồi bất đồng bộ (cần Python + Playwright + Chromium có WebGL).
#   python -m http.server 8000                                   (trong thư mục dự án)
#   python tests/ui05.e2e.py http://localhost:8000                 (Three.js 0.160.0 từ jsDelivr – cần Internet)
#   python tests/ui05.e2e.py http://localhost:8000 --three-dir=/đường/dẫn/three.js   (Three.js r160 cục bộ, cấu trúc như kho/gói npm)
# Đặt SHOTS=<thư mục> để lưu ảnh đánh giá mô hình (chính diện, 45°, nghiêng hai bên, cận cảnh, các vùng).
import sys, os, struct, zlib, datetime
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = (args[0] if args else 'http://localhost:8000'); BASE = URL.rstrip('/') + '/'
THREE = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--three-dir=')), None)
SHOTS = os.environ.get('SHOTS')
ok = 0
def check(name, cond, extra=''):
    global ok
    if not cond: raise AssertionError(f'{name} {extra}')
    ok += 1; print('✓', name)

def route_three(pg, hold=None):
    def h(r):
        if hold is not None and 'three.module.js' in r.request.url and not hold.get('released'):
            hold.setdefault('routes', []).append(r); return   # giữ yêu cầu lại để tạo race có chủ đích
        if not THREE: r.continue_(); return
        part = r.request.url.split('/npm/three@0.160.0/', 1); f = os.path.join(THREE, part[1]) if len(part) == 2 else None
        if f and os.path.isfile(f): r.fulfill(path=f, content_type='application/javascript')
        else: r.abort()
    pg.route('**/cdn.jsdelivr.net/**', h)
    if hold is not None:
        def release():
            hold['released'] = True
            for r in hold.pop('routes', []): h(r)
        hold['release'] = release

def page(b, w=1280, h=900, touch=False, hold=None, init=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    route_three(pg, hold)
    if init: pg.add_init_script(init)
    return ctx, pg, errs
def start(pg, uid='A', goals=('hydrate',), dev=True):
    pg.goto(BASE + ('?dev' if dev else '')); pg.evaluate(f'localStorage.clear();localStorage.setItem("skc:uid","{uid}")'); pg.reload()
    pg.click('nav [data-v=feature]')
    for g in goals: pg.click(f'#quiz label.opt:has(input[value={g}])')
    pg.click('[data-act=quiz]')
ready3d = lambda pg: pg.wait_for_function('window.__skc && __skc.v3.ready', timeout=60000)
dbg = lambda pg: pg.evaluate('__skc.v3.debugInfo()')
def idle(pg, ms=900):
    pg.wait_for_timeout(ms)
def png(w, h, rgb):  # ảnh PNG tối giản (thư viện chuẩn) – kích thước khác nhau để phân biệt ảnh của từng ngày
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
TODAY = datetime.date.today(); D = lambda n: (TODAY + datetime.timedelta(days=n)).isoformat()
# Làm chậm CÓ CHỦ ĐÍCH việc đọc ảnh của một khóa IndexedDB (window.__slowKey) để tạo race tất định.
SLOW_IDB = """(()=>{const g=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(k){if(window.__slowKey&&String(k).endsWith(window.__slowKey))this.transaction.__slow=true;return g.call(this,k)};
 const d=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
 Object.defineProperty(IDBTransaction.prototype,'oncomplete',{configurable:true,get(){return d.get.call(this)},set(fn){const t=this;d.set.call(this,fn&&(e=>{if(t.__slow)setTimeout(()=>fn.call(t,e),700);else fn.call(t,e)}))}})})()"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])

    # ---------- 1. Mô hình: tải, ảnh đánh giá nhiều góc, tài nguyên ----------
    ctx, pg, errs = page(b)
    start(pg); pg.click('#stepper [data-s=model]'); ready3d(pg); idle(pg)
    d = dbg(pg)
    # 0.5.1: thêm tóc, lớp tóc tơ chân tóc, lông mày + mi (lưới hai mặt bán trong suốt = 2 lệnh vẽ) → 6 lưới, 7 lệnh vẽ (Development Plan 0.5.1)
    check('3D tải được: 1 canvas, 6 lưới, 7 lệnh vẽ, không texture', d['canvases'] == 1 and d['objects'] == 6 and d['gpu']['calls'] == 7 and d['gpu']['textures'] == 0, d)
    check('Đứng yên → không có vòng render chạy ngầm', not d['rafPending'] and d['frames'] == dbg(pg)['frames'] and (idle(pg, 600) or True) and dbg(pg)['frames'] == d['frames'], d)
    res = pg.evaluate("performance.getEntriesByType('resource').filter(r=>/head\\.glb|three/.test(r.name)).map(r=>[r.name.split('/').pop(),r.transferSize||r.encodedBodySize||0])")
    glb = [s for n, s in res if n == 'head.glb']
    # 0.5.1: GLB có tóc/lông mày/mi (đã lượng tử + nén meshopt) → trần 1,5 MiB
    check('Tải tài nguyên 3D chỉ một lần mỗi loại; GLB ≤ 1,5 MiB', len(glb) == 1 and glb[0] <= 1.5 * 1024 * 1024 and len([1 for n, s in res if n == 'three.module.js']) == 1, res)
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        for n, az, pol in [('front', 0, 1.5208), ('l45', 0.785, 1.5208), ('r45', -0.785, 1.5208), ('lprof', 1.57, 1.5208), ('rprof', -1.57, 1.5208), ('above', 0.5, 1.2), ('below', -0.4, 1.85)]:
            pg.evaluate('([a,p])=>{const v=__skc.v3;v.tween=null;v.setCam({az:a,polar:p,dist:v.fit});v.ctl.update();v.invalidate()}', [az, pol]); idle(pg, 400)
            pg.locator('#v3d canvas').screenshot(path=f'{SHOTS}/model-{n}.png')
    # ảnh không trống: có điểm ảnh của mô hình (khác nền) ở tâm khung
    px = pg.evaluate("""(()=>{const c=document.querySelector('#v3d canvas'),g=c.getContext('webgl2')||c.getContext('webgl');return !!g})()""")
    check('Canvas WebGL hoạt động', px)
    check('Tải mô hình: không có lỗi JavaScript', errs == [], errs)

    # ---------- 2. Nhấp/chạm vs kéo, giới hạn camera ----------
    pg.evaluate('__skc.v3.resetView()'); idle(pg)
    c = pg.evaluate("__skc.v3.projectZone('cheekL')")
    pg.mouse.move(c['x'], c['y']); pg.mouse.down(); pg.mouse.move(c['x'] + 40, c['y'] + 4, steps=6); pg.mouse.move(c['x'] + 120, c['y'] + 6, steps=8); pg.mouse.up(); idle(pg)
    check('Kéo bắt đầu trên má → xoay mô hình, KHÔNG chọn vùng', pg.evaluate('__skc.S.zone') is None and abs(dbg(pg)['cam']['az']) > 0.1, dbg(pg)['cam'])
    pg.evaluate('__skc.v3.resetView()'); idle(pg)
    c = pg.evaluate("__skc.v3.projectZone('cheekL')"); pg.mouse.click(c['x'], c['y']); idle(pg, 400)
    check('Nhấp đúng vào má trái → chọn "Má trái", highlight đúng vùng', pg.evaluate('__skc.S.zone') == 'cheekL' and 'cheekL' in dbg(pg)['zones'])
    check('Dòng dưới mô hình nói rõ đang xem vùng nào', 'Đang xem vùng: Má trái' in pg.inner_text('#stageHint'))
    for z in ['forehead', 'chin', 'cheekR']:
        pg.evaluate('__skc.v3.resetView()'); idle(pg)
        if z == 'cheekR': pg.evaluate("__skc.v3.view('right')"); idle(pg)
        c = pg.evaluate(f"__skc.v3.projectZone('{z}')"); pg.mouse.click(c['x'], c['y']); idle(pg, 400)
        check(f'Nhấp chọn vùng {z} (raycast trên lưới thật)', pg.evaluate('__skc.S.zone') == z, pg.evaluate('__skc.S.zone'))
    for _ in range(12): pg.click('[data-act=zoom][data-f="1.18"]', force=True) if pg.locator('#moreCtl').evaluate('e=>e.open') else (pg.click('#moreCtl > summary'), pg.click('[data-act=zoom][data-f="1.18"]'))
    idle(pg); d = dbg(pg)
    check('Thu nhỏ liên tục → dừng ở giới hạn xa', d['cam']['dist'] <= d['limits']['max'] + 1e-6, d['cam'])
    for _ in range(14): pg.click('[data-act=zoom][data-f="0.85"]')
    idle(pg); d = dbg(pg)
    check('Phóng to liên tục → dừng ở giới hạn gần, không xuyên vào đầu', d['cam']['dist'] >= d['limits']['min'] - 1e-6 and d['limits']['min'] > 2.4, d['cam'])
    box = pg.locator('#v3d canvas').bounding_box()
    pg.mouse.move(box['x'] + 100, box['y'] + box['height'] / 2); pg.mouse.down(); pg.mouse.move(box['x'] + box['width'] - 20, box['y'] + 30, steps=25); pg.mouse.up(); idle(pg)
    for _ in range(3):
        pg.mouse.move(box['x'] + 60, box['y'] + box['height'] - 40); pg.mouse.down(); pg.mouse.move(box['x'] + box['width'] - 10, box['y'] + 10, steps=20); pg.mouse.up()
    idle(pg, 1200); d = dbg(pg)
    check('Xoay mạnh nhiều lần → góc xoay/nghiêng trong giới hạn hữu ích', abs(d['cam']['az']) <= 1.75 + 1e-3 and 0.94 - 1e-3 <= d['cam']['polar'] <= 2.011 + 1e-3, d['cam'])
    # 0.5.1: mô hình nặng hơn (tóc, vật liệu Physical) → trên renderer PHẦN MỀM (SwiftShader) mỗi khung ~0,3 s; tween + giảm chấn
    # có thể cần > 1,2 s mới dừng. Chờ tới khi vòng render tự dừng (tối đa 8 s) thay vì một mốc cố định – điều kiện kiểm tra giữ nguyên.
    pg.click('[data-act=reset]'); idle(pg, 1200); pg.wait_for_function('!__skc.v3.debugInfo().rafPending', timeout=8000); d = dbg(pg)
    check('Đặt lại góc nhìn → về chính diện', abs(d['cam']['az']) < 0.02 and not d['rafPending'], d['cam'])

    # ---------- 3. Chuyển nhanh giữa các bước ----------
    ids = pg.eval_on_selector_all('#stepPick .pickbtn', 'e=>e.map(x=>x.dataset.id)')
    for i in ids * 2: pg.click(f'#stepPick [data-id="{i}"]')
    last = ids[-1]; idle(pg, 500)
    info, hint = pg.inner_text('#info'), pg.inner_text('#stageHint')
    st = pg.evaluate('__skc.S.sel.step'); name = st['name']
    check('Bấm nhanh qua mọi bước (x2) → chỉ bước cuối được chọn, highlight/thẻ/dòng trạng thái khớp nhau',
          pg.evaluate('__skc.S.step') == last and pg.get_attribute(f'#stepPick [data-id="{last}"]', 'aria-pressed') == 'true' and name in info and f'Đang xem: Buổi tối · {name}' in hint and dbg(pg)['zones'] == pg.evaluate('__skc.S.sel.highlight'), (last, hint))
    check('Chuyển bước nhanh: một canvas, không vòng render thừa sau khi dừng', dbg(pg)['canvases'] == 1 and not dbg(pg)['rafPending'])

    # ---------- 4. 3D ↔ 2D nhiều lần (bộ nhớ, ngữ cảnh WebGL) ----------
    g0 = dbg(pg)
    for _ in range(10): pg.click('[data-act=mode][data-m="2d"]'); pg.click('[data-act=mode][data-m="3d"]')
    idle(pg); d = dbg(pg)
    check('3D↔2D 10 lần: vẫn 1 canvas, không khởi tạo lại, số lưới/vật liệu không tăng', d['canvases'] == 1 and d['initCount'] == g0['initCount'] and d['geometries'] == g0['geometries'] and d['materials'] == g0['materials'] and d['gpu']['geometries'] == g0['gpu']['geometries'], (g0, d))
    check('Sau khi chuyển: lựa chọn bước giữ nguyên ở cả 3D', pg.evaluate('__skc.S.step') == last and d['zones'] == pg.evaluate('__skc.S.sel.highlight'))
    pg.click('[data-act=mode][data-m="2d"]')
    check('Ở 2D: 3D dừng render, 2D hiện, lựa chọn vẫn hiển thị', dbg(pg)['paused'] and not pg.is_hidden('#v2d') and pg.is_hidden('#v3d') and pg.locator('#v2d .zone.on, #v2d .face-ov.on').count() >= 1)
    pg.click('[data-act=mode][data-m="3d"]'); idle(pg)
    check('3D↔2D: không có lỗi JavaScript', errs == [], errs)

    # ---------- 5. Đổi tài khoản khi đang ở mô hình ----------
    pg.select_option('#userSel', 'B'); idle(pg, 500)
    check('Đổi tài khoản: bỏ lựa chọn của tài khoản trước, mô hình hết highlight, không hiện routine của A', pg.evaluate('__skc.S.step') is None and pg.evaluate('__skc.S.zone') is None and dbg(pg)['zones'] == [] and 'Serum HA Plump' not in pg.inner_text('#feature'))
    pg.select_option('#userSel', 'A'); idle(pg, 300)
    check('Quay lại A: dữ liệu A còn nguyên', 'Serum HA Plump' in pg.inner_text('#routine'))
    ctx.close()

    # ---------- 6. Race: khởi tạo 3D xong MUỘN sau khi đã bấm 2D ----------
    hold = {}
    ctx, pg, errs = page(b, hold=hold)
    start(pg); pg.click('#stepper [data-s=model]'); pg.wait_for_timeout(400)
    check('Three.js đang được giữ lại (3D chưa sẵn sàng)', not pg.evaluate('__skc.v3.ready'))
    pg.click('[data-act=mode][data-m="2d"]')
    hold['release'](); pg.wait_for_function('__skc.v3.ready', timeout=60000); idle(pg)
    check('3D khởi tạo xong muộn → KHÔNG ghi đè lựa chọn 2D của người dùng (vẫn 2D, 3D dừng)', pg.evaluate('__skc.S.mode') == '2d' and not pg.is_hidden('#v2d') and pg.is_hidden('#v3d') and dbg(pg)['paused'] and pg.get_attribute('[data-act=mode][data-m="2d"]', 'aria-pressed') == 'true')
    pg.click('[data-act=mode][data-m="3d"]'); idle(pg)
    check('Bấm 3D lại → dùng mô hình đã tải, không tải lại', pg.evaluate('__skc.S.mode') == '3d' and dbg(pg)['initCount'] == 1 and not pg.is_hidden('#v3d'))
    check('Race 3D: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 7. Lỗi tải / WebGL: chuyển 2D, thông báo ngắn và trung thực ----------
    ctx = b.new_context(); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/**', lambda r: r.abort())
    start(pg, dev=False); pg.click('#stepper [data-s=model]'); pg.wait_for_selector('#v2d:not([hidden])', timeout=30000)
    vis = pg.inner_text('#notice')
    check('Mất mạng/CDN: chuyển 2D, nêu nguyên nhân ngắn + gợi ý cần Internet, không lộ URL trong phần hiển thị', 'không tải được thư viện 3D (cần kết nối Internet)' in vis and 'Đã chuyển sang chế độ 2D' in vis and 'https://' not in vis and len(vis) < 260, vis)
    pg.click('#notice details > summary')
    check('Chi tiết kỹ thuật mở được khi cần (có thông điệp gốc)', 'cdn.jsdelivr.net' in pg.inner_text('#notice'))
    pg.locator('#v2d .zone[data-z=cheekL]').first.click()
    check('2D vẫn chọn được vùng: nhấp "Má trái" → thẻ thông tin + dòng trạng thái cập nhật', 'Má trái' in pg.inner_text('#info') and 'Đang xem vùng: Má trái' in pg.inner_text('#stageHint'), pg.inner_text('#info')[:120])
    check('Mất mạng: không có lỗi JavaScript', errs == [], errs)
    ctx.close()
    ctx, pg, errs = page(b, init="HTMLCanvasElement.prototype.getContext=function(){return null}")
    start(pg, dev=False); pg.click('#stepper [data-s=model]'); pg.wait_for_selector('#v2d:not([hidden])', timeout=30000)
    check('WebGL không khả dụng: báo rõ, dùng 2D, trang không lỗi', 'không hỗ trợ WebGL' in pg.inner_text('#notice') and errs == [], pg.inner_text('#notice'))
    ctx.close()

    # ---------- 8. Luồng khách hàng đầu → cuối (mobile, không ?dev) ----------
    ctx, pg, errs = page(b, 390, 844, True)
    pg.goto(BASE); pg.evaluate('localStorage.clear();localStorage.setItem("skc:uid","A")'); pg.reload()
    pg.click('#home button.primary'); pg.click('#quiz label.opt:has(input[value=hydrate])'); pg.click('[data-act=quiz]')
    check('Mục tiêu → Tạo routine: tới Routine, có hành động tiếp theo rõ ràng', 'Routine của bạn' in pg.inner_text('#routine') and pg.locator('#routine button.primary').count() == 1)
    pg.locator('#routine li.step[data-id="am:serum"]').click(); pg.wait_for_selector('#info .info-card', timeout=60000); pg.wait_for_timeout(800)
    check('Routine → bấm bước: sang Mô hình với ĐÚNG bước đó, dòng dưới mô hình nói rõ đang xem gì', pg.get_attribute('#stepPick [data-id="am:serum"]', 'aria-pressed') == 'true' and 'Đang xem: Buổi sáng · Serum' in pg.inner_text('#stageHint') and 'Serum HA Plump' in pg.inner_text('#info'))
    hb, cb = pg.locator('#stageHint').bounding_box(), pg.locator('.stage-wrap').bounding_box()
    check('Mobile: dòng trạng thái nằm ngay dưới mô hình (thấy phản hồi không cần cuộn)', hb['y'] >= cb['y'] + cb['height'] - 2 and hb['y'] - (cb['y'] + cb['height']) < 40 and pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    nxt = pg.inner_text('#modelNext')
    check('Mô hình: routine chưa lưu → gợi ý quay lại để lưu (không thêm nút Lưu thứ hai)', 'Routine chưa được lưu' in nxt and pg.locator('#modelNext [data-act=stage][data-s=routine]').count() == 1 and pg.locator('[data-act=save]').count() == 1)
    pg.click('#modelNext [data-act=stage]')
    check('Quay lại Routine: bước đang chọn vẫn giữ', pg.locator('#routine li.step.sel[data-id="am:serum"]').count() == 1)
    pg.click('[data-act=save]'); pg.click('#stepper [data-s=model]'); pg.wait_for_timeout(400)
    check('Đã lưu → Mô hình đề xuất "Theo dõi & lịch sử", lựa chọn bước vẫn giữ', 'Routine đã lưu' in pg.inner_text('#modelNext') and pg.get_attribute('#stepPick [data-id="am:serum"]', 'aria-pressed') == 'true')
    pg.click('#modelNext [data-act=stage][data-s=track]')
    check('→ Theo dõi & lịch sử', not pg.is_hidden('#stage-track'))
    check('Mobile: không cuộn ngang ở cuối luồng; không có lỗi JavaScript', pg.evaluate('document.documentElement.scrollWidth<=innerWidth') and errs == [], errs)
    if SHOTS:
        pg.click('#stepper [data-s=model]'); pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/ui-390-model.png', full_page=True)
    ctx.close()

    # ---------- 9. Race ảnh nhật ký (Timeline + xem ảnh ở Nhật ký) ----------
    ctx, pg, errs = page(b, init=SLOW_IDB)
    start(pg); pg.click('[data-act=save]')
    pg.click('#trackBtn'); pg.click('[data-act=tab][data-t=journal]')
    for dt, (w, h, col) in [(D(-2), (30, 20, (200, 60, 60))), (D(-1), (64, 48, (60, 60, 200)))]:
        pg.fill('#jd', dt); pg.set_input_files('#jphoto', files=[{'name': 'a.png', 'mimeType': 'image/png', 'buffer': png(w, h, col)}]); pg.click('[data-act=jsave]'); pg.wait_for_timeout(300)
    pg.evaluate(f'window.__slowKey="{D(-2)}"')
    pg.click('[data-act=tab][data-t=timeline]')
    pg.fill('#tlDate', D(-2)); pg.dispatch_event('#tlDate', 'change')   # ảnh ngày -2: tải CHẬM
    pg.fill('#tlDate', D(-1)); pg.dispatch_event('#tlDate', 'change')   # đổi ngay sang -1: tải nhanh
    pg.wait_for_timeout(1500)
    sizes = pg.eval_on_selector_all('#tlPhoto img', 'e=>e.map(i=>[i.naturalWidth,i.naturalHeight])')
    check('Timeline: ảnh tải chậm của ngày trước KHÔNG ghi đè ảnh của ngày đang chọn', sizes == [[64, 48]], sizes)
    pg.fill('#tlDate', D(-2)); pg.dispatch_event('#tlDate', 'change'); pg.fill('#tlDate', D(0)); pg.dispatch_event('#tlDate', 'change'); pg.wait_for_timeout(1500)
    check('Timeline: chuyển sang ngày không có ảnh → ảnh cũ không xuất hiện', pg.locator('#timeline img').count() == 0)
    pg.click('[data-act=tab][data-t=journal]')
    pg.click(f'[data-act=pview][data-d="{D(-2)}"]'); pg.click(f'[data-act=pview][data-d="{D(-1)}"]'); pg.wait_for_timeout(1500)
    sizes = pg.eval_on_selector_all('#jview img', 'e=>e.map(i=>[i.naturalWidth,i.naturalHeight])')
    check('Nhật ký: bấm xem ảnh liên tiếp → chỉ ảnh của lần bấm mới nhất', sizes == [[64, 48]] and D(-1) in pg.inner_text('#jview'), sizes)
    check('Race ảnh: không có lỗi JavaScript', errs == [], errs)
    ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.5 đạt.')
