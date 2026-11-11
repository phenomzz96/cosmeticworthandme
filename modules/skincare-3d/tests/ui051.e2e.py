# Kiểm thử giao diện 0.5.1 – mô hình mới chạy THẬT trong trình duyệt (Three.js r160 + WebGL): giải nén meshopt, tóc/lông mày/mi hiển thị,
# vùng da chọn đúng trên mô hình mới, tóc không chặn tương tác, khung hình (máy tính + điện thoại), 2D dự phòng có tóc, hiệu năng.
#   python -m http.server 8000                                   (trong thư mục dự án)
#   python tests/ui051.e2e.py http://localhost:8000                (Three.js 0.160.0 từ jsDelivr – cần Internet)
#   python tests/ui051.e2e.py http://localhost:8000 --three-dir=/đường/dẫn/three.js   (Three.js r160 cục bộ, cấu trúc như kho/gói npm)
# Đặt SHOTS=<thư mục> để lưu ảnh bàn giao (chính diện, 45° trái/phải, nghiêng trái/phải, cận cảnh mắt/môi/chân tóc, 2D).
import sys, os, io, statistics
from playwright.sync_api import sync_playwright
from PIL import Image
args = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = (args[0] if args else 'http://localhost:8000'); BASE = URL.rstrip('/') + '/'
THREE = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--three-dir=')), None)
SHOTS = os.environ.get('SHOTS')
ok = 0
def check(name, cond, extra=''):
    global ok
    if not cond: raise AssertionError(f'{name} {extra}')
    ok += 1; print('✓', name)
def route_three(pg, block=False):
    def h(r):
        if block: r.abort(); return
        if not THREE: r.continue_(); return
        part = r.request.url.split('/npm/three@0.160.0/', 1); f = os.path.join(THREE, part[1]) if len(part) == 2 else None
        if f and os.path.isfile(f): r.fulfill(path=f, content_type='application/javascript')
        else: r.abort()
    pg.route('**/cdn.jsdelivr.net/**', h)
def page(b, w=1280, h=900, touch=False, block=False, scale=1):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=scale)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    route_three(pg, block)
    return ctx, pg, errs
def start(pg, dev=True):
    pg.goto(BASE + ('?dev' if dev else '')); pg.evaluate('localStorage.clear();localStorage.setItem("skc:uid","A")'); pg.reload()
    pg.click('nav [data-v=feature]'); pg.click('#quiz label.opt:has(input[value=hydrate])'); pg.click('[data-act=quiz]')
    pg.click('#stepper [data-s=model]')
dbg = lambda pg: pg.evaluate('__skc.v3.debugInfo()')
def settle(pg, ms=300):
    pg.wait_for_function('!__skc.v3.debugInfo().rafPending', timeout=20000); pg.wait_for_timeout(ms)
def cam(pg, az, polar, dist=None, target=None):
    pg.evaluate('([a,p,d,t])=>{const v=__skc.v3;v.tween=null;if(t){v.target.set(...t);v.ctl.target.copy(v.target)}v.setCam({az:a,polar:p,dist:d??v.fit});v.ctl.update();v.invalidate()}', [az, polar, dist, target]); settle(pg)
def proj(pg, x, y, z):  # điểm 3D (tọa độ mô hình) → tọa độ trang
    return pg.evaluate('([x,y,z])=>{const v=__skc.v3,p=new v.T.Vector3(x,y,z).project(v.cam),r=v.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height,inside:Math.abs(p.x)<=1&&Math.abs(p.y)<=1}}', [x, y, z])
def pixel(pg, x, y):
    im = Image.open(io.BytesIO(pg.screenshot(clip={'x': x - 2, 'y': y - 2, 'width': 5, 'height': 5}))).convert('RGB')
    px = [im.getpixel((i, j)) for i in range(im.width) for j in range(im.height)]
    return tuple(sum(p[k] for p in px) / len(px) for k in range(3))
lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])

    # ---------- 1. Tải mô hình nén, đúng thành phần ----------
    ctx, pg, errs = page(b)
    start(pg); pg.wait_for_function('window.__skc && __skc.v3.ready', timeout=60000); settle(pg)
    d = dbg(pg)
    check('Mô hình 0.5.1 tải và giải nén được: 6 lưới (da, mắt, nắp, tóc, tóc tơ, lông mày+mi), 7 lệnh vẽ, 0 texture', d['objects'] == 6 and d['gpu']['calls'] == 7 and d['gpu']['textures'] == 0, d)
    names = pg.evaluate("(()=>{const r=[];__skc.v3.root.traverse(o=>{if(o.isMesh)r.push([o.name,o.geometry.attributes.position.count,o.geometry.index.count/3,o.material.type])});return r})()")
    nm = {n: (v, t, m) for n, v, t, m in names}
    check('Các lưới có đủ dữ liệu sau giải nén (đỉnh/tam giác khớp tệp gốc trước nén)', nm['hair'][0] == 36229 and nm['hair'][1] == 61520 and nm['skin'][0] == 18374 and set(nm) == {'skin', 'eyes', 'cap', 'hair', 'hairline', 'brows'}, names)
    check('Vật liệu đúng: da/tóc Physical, lông mày+mi Lambert, mắt Physical (shader mống mắt)', nm['skin'][2] == nm['hair'][2] == nm['hairline'][2] == nm['eyes'][2] == 'MeshPhysicalMaterial' and nm['brows'][2] == 'MeshLambertMaterial', names)
    res = pg.evaluate("performance.getEntriesByType('resource').map(r=>r.name)")
    dec = [r for r in res if 'meshopt_decoder' in r]
    check('Bộ giải nén meshopt lấy từ CHÍNH gói three@0.160.0 (cùng CDN), một lần', len(dec) == 1 and '/npm/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js' in dec[0], dec)
    check('Không lỗi JavaScript khi tải', errs == [], errs)
    check('Chưa ở chế độ nhẹ khi vừa tải', not dbg(pg)['lite'])

    # ---------- 2. Hình ảnh: tóc, da, mắt hiển thị đúng chỗ ----------
    cam(pg, 0, 1.5208)
    crown = proj(pg, 0, 0.84, 0.75); fore = pg.evaluate("__skc.v3.projectZone('forehead')")
    c_hair, c_fore = pixel(pg, crown['x'], crown['y']), pixel(pg, fore['x'], fore['y'])
    check('Chính diện: đỉnh đầu là tóc nâu sẫm, vùng trán là da sáng (tóc không che trán)', lum(c_hair) < 90 and c_hair[0] > c_hair[2] and lum(c_fore) > 150, (c_hair, c_fore))
    cam(pg, 0, 1.5208, 2.4, [0.2865, 0.02, 0.6]); eye = proj(pg, 0.2865 + 0.042, 0.016, 0.966); c_eye = pixel(pg, eye['x'], eye['y'])
    check('Mắt (cận): mống mắt nâu ấm (không xám, không đen kịt) quanh đồng tử', 25 < lum(c_eye) < 140 and c_eye[0] > c_eye[2] + 8, c_eye)
    pg.evaluate('(()=>{const v=__skc.v3;v.target.set(0,-0.28,0.35);v.ctl.target.copy(v.target)})()')
    bc = pg.evaluate('(()=>{let c=null;__skc.v3.root.traverse(o=>{if(o.userData?.hair)c=o.userData.hair.bun.c});return c})()')  # tâm búi ghi trong GLB (extras.hair)
    cam(pg, 1.57, 1.5208); bun = proj(pg, bc[0], bc[1], bc[2]); c_bun = pixel(pg, bun['x'], bun['y'])
    check('Nghiêng: thấy búi tóc thấp sau gáy', lum(c_bun) < 90, c_bun)

    # ---------- 3. Tương tác vùng da trên mô hình mới; tóc không chặn ----------
    pg.evaluate('__skc.v3.resetView()'); settle(pg)
    for z, label in [('forehead', 'Trán'), ('cheekL', 'Má trái'), ('cheekR', 'Má phải'), ('chin', 'Cằm')]:
        c = pg.evaluate(f"__skc.v3.projectZone('{z}')"); before = pixel(pg, c['x'], c['y'])
        pg.mouse.click(c['x'], c['y']); settle(pg, 500); after = pixel(pg, c['x'], c['y'])
        check(f'Nhấp {label}: chọn đúng vùng (raycast lưới da mới) và bề mặt chuyển sắc nhấn', pg.evaluate('__skc.S.zone') == z and (after[1] - after[0]) - (before[1] - before[0]) > 12, (pg.evaluate('__skc.S.zone'), before, after))
        pg.click('#info [data-act=clearsel]'); settle(pg)
    crown = proj(pg, 0, 0.84, 0.75); pg.mouse.click(crown['x'], crown['y']); settle(pg)
    check('Nhấp lên tóc (đỉnh đầu): không chọn vùng nào, không lỗi', pg.evaluate('__skc.S.zone') is None and errs == [], errs)
    brow = proj(pg, 0.30, 0.17, 0.98); pg.mouse.move(brow['x'], brow['y']); pg.wait_for_timeout(300)
    check('Lông mày/mi không phải vùng da để chọn (rê chuột lên lông mày không báo vùng)', dbg(pg)['hover'] in (None, 'forehead'), dbg(pg)['hover'])

    # ---------- 4. Hiệu năng ----------
    pg.evaluate('__skc.v3.resetView()'); settle(pg)
    box = pg.locator('#v3d canvas').bounding_box(); f0 = dbg(pg)['frames']; t0 = pg.evaluate('performance.now()')
    pg.mouse.move(box['x'] + 120, box['y'] + box['height'] / 2); pg.mouse.down()
    for i in range(30): pg.mouse.move(box['x'] + 120 + i * 12, box['y'] + box['height'] / 2 + (i % 5)); pg.wait_for_timeout(16)
    pg.mouse.up(); settle(pg); fps = (dbg(pg)['frames'] - f0) / ((pg.evaluate('performance.now()') - t0) / 1000)
    ft = pg.evaluate('()=>{const v=__skc.v3,R=v.renderer,g=R.getContext(),T=[];for(let i=0;i<12;i++){const t=performance.now();R.render(v.scene,v.cam);g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array(4));T.push(performance.now()-t)}T.sort((a,b)=>a-b);return T[6]}')
    print(f'   (đo trên renderer phần mềm SwiftShader: {fps:.0f} khung/giây khi kéo, trung vị {ft:.1f} ms/khung; GPU thật nhanh hơn nhiều)')
    # Ngưỡng ở đây chỉ chặn sự cố nghiêm trọng (treo/lặp vô hạn): renderer phần mềm chậm hơn GPU thật hàng chục lần
    # (0.5 đo cùng cách ≈ 100 ms/khung). Thiết bị chậm thật → PerfMeter đề xuất chuyển 2D (giữ nguyên từ 0.5).
    check('Renderer phần mềm vẫn tương tác được (không treo): ≥ 2 khung/giây, ≤ 600 ms/khung', fps >= 2 and ft <= 600, (fps, ft))
    check('Đứng yên → không render ngầm', not dbg(pg)['rafPending'])
    auto = dbg(pg)['lite']  # renderer phần mềm thường đã bị PerfMeter đánh giá "chậm" trong lúc kéo ở trên → tự bật chế độ nhẹ
    if not auto: pg.evaluate('__skc.v3.lite()')
    settle(pg); d = dbg(pg)
    print(f'   (chế độ nhẹ {"TỰ bật bởi PerfMeter" if auto else "bật thủ công"})')
    check('Chế độ nhẹ cho thiết bị chậm: mật độ điểm ảnh = 1, vẫn render, không lỗi', d['lite'] and d['pixelRatio'] == 1 and d['ready'] and errs == [], (d.get('lite'), d.get('pixelRatio'), errs))
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
    ctx.close()

    # ---------- 5. Ảnh bàn giao (độ phân giải gấp đôi) ----------
    if SHOTS:
        ctx, pg, errs = page(b, 1280, 900, scale=2)
        start(pg); pg.wait_for_function('window.__skc && __skc.v3.ready', timeout=60000); settle(pg)
        for n, az, pol in [('chinh-dien', 0, 1.5208), ('45-trai', 0.785, 1.5208), ('45-phai', -0.785, 1.5208), ('nghieng-trai', 1.57, 1.5208), ('nghieng-phai', -1.57, 1.5208)]:
            cam(pg, az, pol); pg.locator('#v3d canvas').screenshot(path=f'{SHOTS}/model-{n}.png')
        pg.evaluate('__skc.v3.ctl.minDistance=1.0')  # chỉ cho ảnh cận cảnh bàn giao (người dùng không zoom gần đến mức này)
        for n, az, pol, d, t in [('can-mat', 0.0, 1.55, 1.25, [0, 0.03, 0.85]), ('can-mat-45', 0.6, 1.55, 1.35, [0.12, 0.03, 0.8]), ('can-moi', 0.3, 1.58, 1.15, [0, -0.66, 1.0]),
                                 ('can-chan-toc', 0.45, 1.42, 1.8, [0, 0.45, 0.6]), ('can-tai-gay', 1.3, 1.5, 2.0, [0.55, 0.05, 0.1]), ('can-ban-mat', 0.35, 1.53, 2.4, [0, -0.2, 0.7])]:
            cam(pg, az, pol, d, t); pg.locator('#v3d canvas').screenshot(path=f'{SHOTS}/model-{n}.png')
        pg.evaluate('(()=>{const v=__skc.v3;v.target.set(0,-0.28,0.35);v.ctl.target.copy(v.target);v.resize()})()'); cam(pg, 0, 1.5208)
        c = pg.evaluate("__skc.v3.projectZone('cheekL')"); pg.mouse.click(c['x'], c['y']); settle(pg, 600)
        pg.locator('#v3d canvas').screenshot(path=f'{SHOTS}/model-chon-vung-ma-trai.png')
        ctx.close()

    # ---------- 6. Điện thoại: khung hình chứa trọn tóc và cằm ----------
    ctx, pg, errs = page(b, 390, 844, touch=True)
    start(pg); pg.wait_for_function('window.__skc && __skc.v3.ready', timeout=60000); settle(pg)
    top, chin = proj(pg, 0, 1.04, 0.3), proj(pg, 0, -0.87, 1.05)
    check('Điện thoại dọc: đỉnh tóc và cằm đều nằm trong khung 3D', top['inside'] and chin['inside'], (top, chin))
    c = pg.evaluate("__skc.v3.projectZone('chin')"); pg.tap('#v3d canvas', position={'x': c['x'] - pg.locator('#v3d canvas').bounding_box()['x'], 'y': c['y'] - pg.locator('#v3d canvas').bounding_box()['y']}); settle(pg)
    check('Điện thoại: chạm vào cằm → chọn "Cằm"', pg.evaluate('__skc.S.zone') == 'chin', pg.evaluate('__skc.S.zone'))
    check('Điện thoại: không lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 7. 2D dự phòng có tóc (mất mạng/CDN) ----------
    ctx, pg, errs = page(b, block=True, scale=2 if SHOTS else 1)
    start(pg); pg.wait_for_selector('#v2d:not([hidden])', timeout=30000)
    check('Không tải được 3D → tự chuyển 2D', not pg.is_hidden('#v2d') and pg.is_hidden('#v3d'))
    check('Sơ đồ 2D có tóc (vén gọn, cùng hình dáng mô hình 3D)', pg.locator('#v2d svg path.hair').count() == 1 and pg.locator('#v2d svg path.hair').is_visible())
    for z in ['forehead', 'cheekL', 'cheekR', 'chin']:
        bb = pg.locator(f'#v2d .zone[data-z={z}]').bounding_box(); cx, cy = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
        top_el = pg.evaluate('([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.getAttribute("data-z")}', [cx, cy])
        check(f'2D: vùng {z} không bị tóc/nét mặt che (phần tử trên cùng tại tâm vùng là chính vùng đó)', top_el == z, top_el)
    pg.locator('#v2d .zone[data-z=forehead]').click()
    check('2D: nhấp "Trán" → chọn đúng vùng', pg.evaluate('__skc.S.zone') == 'forehead')
    if SHOTS: pg.locator('#v2d').screenshot(path=f'{SHOTS}/so-do-2d.png')
    check('2D dự phòng: không lỗi JavaScript', errs == [], errs)
    ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.5.1 đạt.')
