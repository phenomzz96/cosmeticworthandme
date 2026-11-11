# Kiểm thử giao diện 0.3.1 (tùy chọn): cần Python + Playwright + Chromium.
#   python -m http.server 8000           (trong thư mục dự án)
#   python tests/ui031.e2e.py http://localhost:8000
# Hoặc mô phỏng việc Live Server chèn script tự tải lại vào trang:
#   python tests/serve_like_live_server.py 5500 &   rồi   python tests/ui031.e2e.py http://localhost:5500 --live
# Chặn CDN Three.js để kết quả ổn định (trang tự chuyển 2D). Payload XSS chỉ tăng biến window.__xss, không gửi dữ liệu ra ngoài.
import sys, json, datetime
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = args[0] if args else 'http://localhost:8000'
LIVE = '--live' in sys.argv
ok = 0
def check(name, cond, extra=''):
    global ok
    if not cond: raise AssertionError(f'{name} {extra}')
    ok += 1; print('✓', name)

TODAY = datetime.date.today()
D = lambda n: (TODAY + datetime.timedelta(days=n)).isoformat()
X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">'
X2 = '"><svg onload="window.__xss=(window.__xss||0)+1"></svg>'
SEED = {"schema": 3, "quiz": {"goals": ["hydrate", X], "skin": X2}, "selection": ["p01", "p03", "p04", "p05", "p08", "p10", X],
  "versions": [{"id": "v-x", "n": 1, "createdAt": D(-1) + "T05:00:00Z", "quiz": {"goals": ["hydrate", X], "skin": X2}, "quizKnown": True,
    "selection": ["p01", X2], "rulesVersion": X, "snapshot": {"status": "ready", "steps": [{"id": "am:x", "period": X, "name": X, "products": [{"id": "p01", "name": X2}]}]},
    "note": X, "change": X2, "appliedFrom": D(-1), "basisId": None, "legacy": None}],
  "applications": [{"versionId": "v-x", "from": D(-1), "recordedAt": X, "kind": X}],
  "corrections": [{"target": 0, "from": D(-2), "prevFrom": D(-1), "recordedAt": D(-1) + "T06:00:00Z", "reason": X}],
  "journal": {D(-2): {"dry": X, "oil": 1, "irr": 0, "skipped": False, "note": X, "photo": False}, X: {"dry": 1, "oil": 1, "irr": 1, "note": X2}},
  "startDate": D(-5), "basisId": "v-x"}
ON_ATTRS = "[...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>/^on/i.test(a.name))).length"
# 0.4: giao diện dùng icon/hình minh họa SVG hằng số (.ic, .art, .chart, .dot) → chỉ đếm SVG KHÁC các loại đó (dấu hiệu bị chèn).
BAD_NODES = "document.querySelectorAll('img[src=x],#routine svg:not(.ic):not(.art),#timeline svg:not(.ic),#journal svg:not(.chart):not(.dot):not(.ic),#info svg:not(.ic)').length"
# Script hợp lệ của trang: importmap + module main.js (+ script tự tải lại nếu mô phỏng Live Server).
SCRIPTS = "document.querySelectorAll('script').length"

def new_page(b, init=None):
    ctx = b.new_context(); pg = ctx.new_page(); errs = []; dialogs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
    pg.route('**/cdn.jsdelivr.net/**', lambda r: r.abort())
    if init: pg.add_init_script(init)
    return ctx, pg, errs, dialogs

# 0.4.1: giao diện chia 3 giai đoạn + khu "Theo dõi & lịch sử"; công cụ developer nằm sau "Developer mode".
# Chỉ THÊM bước điều hướng (dòng đánh dấu "# 0.4.1 điều hướng") và đổi nơi đọc nội dung đã chuyển chỗ
# (danh sách phiên bản: #routine → #versions). Không đổi điều kiện kiểm tra.
def stage(pg, s):  # 0.4.1 điều hướng
    pg.click('#trackBtn' if s == 'track' else f'#stepper [data-s={s}]')
def tab(pg, t):  # 0.4.1 điều hướng
    stage(pg, 'track'); pg.click(f'#stage-track [data-act=tab][data-t={t}]')
def save_opts(pg):  # 0.4.1 điều hướng: mở "Tùy chọn lưu" ở bước Routine
    stage(pg, 'routine'); pg.evaluate("document.querySelector('#saveOpts').open=true")
RV = lambda pg: pg.inner_text('#routine') + pg.inner_text('#versions')  # 0.4.1: routine + danh sách phiên bản

def open_feature(pg):
    pg.click('nav [data-v=feature]'); stage(pg, 'model')  # 0.4.1 điều hướng: 3D/2D chỉ khởi tạo ở bước Mô hình
    pg.wait_for_selector('#v2d:not([hidden])')

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- A. XSS: dữ liệu độc hại trong localStorage + nhập từ giao diện ----------
    ctx, pg, errs, dialogs = new_page(b)
    pg.goto(URL); base_scripts = pg.evaluate(SCRIPTS)
    pg.evaluate('d=>{localStorage.clear();localStorage.setItem("skc:A",JSON.stringify(d));localStorage.setItem("skc:uid","A")}', SEED); pg.reload(); open_feature(pg)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    tab(pg, 'timeline')  # 0.4.1 điều hướng
    pg.fill('#tlDate', D(-2)); pg.dispatch_event('#tlDate', 'change')
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    check('XSS: không thực thi mã từ dữ liệu đã lưu', pg.evaluate('window.__xss') is None and dialogs == [])
    check('XSS: không có thuộc tính on* nào trong DOM', pg.evaluate(ON_ATTRS) == 0, pg.evaluate(ON_ATTRS))
    check('XSS: không tạo thẻ img/svg từ dữ liệu', pg.evaluate(BAD_NODES) == 0)
    check('XSS: không thêm thẻ script', pg.evaluate(SCRIPTS) == base_scripts)
    rt, tl, jn = RV(pg), pg.inner_text('#timeline'), pg.inner_text('#journal')  # 0.4.1: ghi chú phiên bản nằm ở #versions
    check('XSS: ghi chú/thay đổi/bộ quy tắc phiên bản hiện thành chữ', X in rt and X2.strip() in rt)
    check('XSS: ảnh chụp routine (timeline) + lý do sửa ngày (tab Phiên bản, 0.4.3) hiện thành chữ', X in tl and X2.strip() in tl and X in pg.inner_text('#versions'))
    check('XSS: nhật ký (ghi chú, điểm, khóa ngày lạ) hiện thành chữ', jn.count(X) >= 2 and 'ngày không hợp lệ' in jn)
    check('XSS: giao diện còn nguyên cấu trúc', pg.locator('#routine [data-act=save]').count() == 1 and pg.locator('#journal table tr').count() == 3 and pg.locator('#quiz input').count() == 9)
    # nhập payload từ giao diện → lưu → tải lại
    tab(pg, 'journal')  # 0.4.1 điều hướng
    pg.fill('#jd', D(0)); pg.fill('#jnote', X); pg.click('[data-act=jsave]')
    save_opts(pg)  # 0.4.1 điều hướng
    pg.fill('#vnote', X2); pg.click('[data-act=save]')
    pg.reload(); open_feature(pg); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    check('XSS: nội dung nhập từ giao diện hiển thị lại an toàn sau reload', X in pg.inner_text('#journal') and X2.strip() in RV(pg) and pg.evaluate('window.__xss') is None and pg.evaluate(ON_ATTRS) == 0)
    check('XSS: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- B. Ngày bắt đầu theo dõi (trước đây "Ngày 0") và sửa ngày áp dụng ----------
    ctx, pg, errs, dialogs = new_page(b)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); open_feature(pg)
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.check('#quiz input[value=hydrate]'); pg.click('[data-act=quiz]'); pg.click('[data-act=save]')
    hist = lambda: pg.evaluate('JSON.parse(localStorage.getItem("skc:A"))')
    before = hist()
    check('Ngày bắt đầu theo dõi tự đặt ở lần áp dụng đầu tiên', before['startDate'] == D(0) and len(before['applications']) == 1)
    # 0.4.3: nhãn "Ngày bắt đầu theo dõi" (khu "Tùy chỉnh mốc theo dõi" thu gọn); lịch sử + công cụ sửa nằm ở tab Phiên bản.
    F = lambda n: (TODAY + datetime.timedelta(days=n)).strftime('%d/%m/%Y')
    tab(pg, 'timeline')  # 0.4.1 điều hướng
    check('Khu "Tùy chỉnh mốc theo dõi" thu gọn mặc định', not pg.evaluate("document.querySelector('#tlCustom').open"))
    pg.click('#tlCustom > summary')
    pg.fill('#startDate', D(-13)); pg.dispatch_event('#startDate', 'change'); tl = pg.inner_text('#timeline')
    after = hist()
    check('Test A: đổi ngày bắt đầu theo dõi → thông báo ngắn + lưu ý khác ngày áp dụng, không đổi lịch sử', 'Lịch sử đã lưu không thay đổi' in tl and 'khác ngày bắt đầu áp dụng routine' in tl and after['applications'] == before['applications'] and after['versions'] == before['versions'] and after['startDate'] == D(-13))
    pg.click('[data-act=day][data-n="14"]'); tl = pg.inner_text('#timeline')
    check('Test A: mốc Tuần 2 = ngày bắt đầu + 14, số ngày tương đối đúng', F(1) in tl and '14 ngày sau ngày bắt đầu' in tl)
    pg.click('[data-act=day][data-n="0"]'); tl = pg.inner_text('#timeline')
    check('Test A: ngày bắt đầu theo dõi trước ngày áp dụng thực tế → không có routine giả', 'Chưa có routine nào được ghi nhận áp dụng vào ngày này' in tl and 'trước khi bạn bắt đầu áp dụng' in tl)
    tab(pg, 'versions'); pg.evaluate("document.querySelector('#versions details.hist').open=true"); pg.click('[data-act=fix]')
    tl = pg.inner_text('#versions')
    check('Test B: sửa ngày áp dụng hiển thị bước xác nhận rõ ràng', 'Bạn đang sửa lịch sử áp dụng thực tế' in tl and pg.locator('[data-act=fixok]').count() == 1)
    pg.fill('#fixDate', D(-3)); pg.click('[data-act=fixno]')
    check('Test B: hủy → lịch sử không đổi', hist()['applications'] == before['applications'] and hist().get('corrections', []) == [])
    pg.click('[data-act=fix]'); pg.fill('#fixDate', D(-3)); pg.fill('#fixReason', 'bắt đầu sớm hơn'); pg.click('[data-act=fixok]')
    h = hist(); tl = pg.inner_text('#versions')
    check('Test B: xác nhận → ghi thêm bản ghi sửa, bản ghi gốc giữ nguyên', h['applications'] == before['applications'] and len(h['corrections']) == 1 and h['corrections'][0]['from'] == D(-3) and 'đã sửa ngày áp dụng' in tl)
    tab(pg, 'timeline'); pg.fill('#tlDate', D(-3)); pg.dispatch_event('#tlDate', 'change')
    check('Test B: timeline tính lại theo ngày đã sửa', 'Routine đã áp dụng' in pg.inner_text('#timeline') and 'v1' in pg.inner_text('#timeline'))
    pg.fill('#startDate', ''); pg.dispatch_event('#startDate', 'change')
    check('Bỏ ngày bắt đầu theo dõi: lịch sử giữ nguyên, có thông báo', hist()['startDate'] is None and hist()['applications'] == before['applications'] and 'Đã bỏ ngày bắt đầu theo dõi' in pg.inner_text('#timeline'))
    check('Ngày bắt đầu theo dõi / sửa ngày: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- C. localStorage bị chặn hoàn toàn ----------
    BLOCK = "Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('The operation is insecure.','SecurityError')}})"
    ctx, pg, errs, dialogs = new_page(b, BLOCK)
    pg.goto(URL); open_feature(pg)
    check('Storage bị chặn: trang tải được, có cảnh báo lưu tạm', 'chỉ tạm thời' in pg.inner_text('#storage') and 'mất khi tải lại' in pg.inner_text('#storage'))
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.check('#quiz input[value=hydrate]'); pg.click('[data-act=quiz]'); save_opts(pg); pg.fill('#vnote', 'bản A'); pg.click('[data-act=save]')
    r = pg.inner_text('#routine')
    check('Storage bị chặn: lưu routine báo "chỉ lưu tạm", không báo "Đã lưu"', 'chỉ lưu tạm trong phiên' in r and 'Đã lưu v1' not in r and 'Đã tạo v1' in r)
    pg.select_option('#userSel', 'B')
    check('Storage bị chặn: User B không thấy dữ liệu của A', 'Chưa có phiên bản nào' in RV(pg) and not pg.is_checked('#quiz input[value=hydrate]'))
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.check('#quiz input[value=acne]'); pg.click('[data-act=quiz]'); pg.click('[data-act=save]')
    pg.select_option('#userSel', 'A'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    check('Storage bị chặn: quay lại A, dữ liệu tạm của A còn (tách khỏi B)', pg.locator('[data-act=restore]').count() == 1 and 'bản A' in RV(pg) and pg.is_checked('#quiz input[value=hydrate]') and not pg.is_checked('#quiz input[value=acne]'))
    pg.reload(); open_feature(pg)
    check('Storage bị chặn: sau reload dữ liệu tạm mất (đúng như thông báo), trang vẫn chạy', 'Chưa có phiên bản nào' in RV(pg) and 'chỉ tạm thời' in pg.inner_text('#storage'))
    check('Storage bị chặn: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- D. setItem() lỗi (vượt dung lượng) rồi thử lại ----------
    ctx, pg, errs, dialogs = new_page(b)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); open_feature(pg)
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.check('#quiz input[value=hydrate]'); pg.click('[data-act=quiz]'); pg.click('[data-act=save]')
    pg.evaluate("window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('The quota has been exceeded.','QuotaExceededError')};0")
    save_opts(pg)  # 0.4.1 điều hướng
    pg.fill('#vnote', 'v2 lúc đầy'); pg.check('#vdraft'); pg.click('[data-act=save]')
    check('Quota: báo chưa lưu bền vững, có nút thử lại', 'chỉ lưu tạm' in pg.inner_text('#routine') and 'đầy' in pg.inner_text('#storage') and pg.locator('[data-act=retry]').count() == 1)
    check('Quota: dữ liệu trong trình duyệt vẫn là bản cũ', len(pg.evaluate('JSON.parse(localStorage.getItem("skc:A")).versions')) == 1)
    tab(pg, 'journal')  # 0.4.1 điều hướng
    pg.fill('#jd', D(0)); pg.click('[data-act=jsave]')
    check('Quota: nhật ký cũng báo chưa lưu bền vững', 'CHƯA lưu bền vững' in pg.inner_text('#journal') or 'chỉ lưu tạm' in pg.inner_text('#journal'))
    pg.click('[data-act=retry]')
    check('Quota: thử lại khi vẫn đầy → vẫn báo lỗi', 'Vẫn chưa lưu được' in pg.inner_text('#routine'))
    pg.evaluate('Storage.prototype.setItem=window.__set;0'); pg.click('[data-act=retry]')
    check('Quota: hết lỗi → thử lại lưu được, banner biến mất', 'Đã lưu dữ liệu vào bộ nhớ trình duyệt' in pg.inner_text('#routine') and pg.inner_text('#storage').strip() == '')
    pg.reload(); open_feature(pg)
    check('Quota: sau reload có đủ 2 phiên bản + nhật ký', pg.locator('[data-act=restore]').count() == 2 and pg.locator('#journal table tr').count() == 2)
    pg.evaluate("window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};0")
    save_opts(pg)  # 0.4.1 điều hướng
    pg.check('#vdraft'); pg.click('[data-act=save]'); pg.evaluate('Storage.prototype.setItem=window.__set;0'); pg.reload(); open_feature(pg)
    check('Quota: tải lại sau lần lưu thất bại → chỉ còn dữ liệu đã lưu bền vững', pg.locator('[data-act=restore]').count() == 2)
    check('Quota: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- E. getItem() lỗi và JSON hỏng ----------
    ctx, pg, errs, dialogs = new_page(b)
    pg.goto(URL); pg.evaluate('localStorage.clear();localStorage.setItem("skc:A",\'{"schema":3,"versions":[],"note":"gốc"}\')')
    pg.add_init_script("const g=Storage.prototype.getItem;window.__get=g;Storage.prototype.getItem=function(k){if(k==='skc:A')throw new DOMException('denied','SecurityError');return g.call(this,k)}")
    pg.reload(); open_feature(pg)
    check('getItem lỗi: trang chạy, báo không đọc được', 'Không đọc được' in pg.inner_text('#routine') and 'chỉ tạm thời' in pg.inner_text('#storage'))
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.check('#quiz input[value=hydrate]'); pg.click('[data-act=quiz]'); pg.click('[data-act=save]')
    check('getItem lỗi: không ghi đè dữ liệu chưa đọc được', pg.evaluate('window.__get.call(localStorage,"skc:A")') == '{"schema":3,"versions":[],"note":"gốc"}')
    ctx.close()
    ctx, pg, errs, dialogs = new_page(b)
    pg.goto(URL); pg.evaluate('localStorage.clear();localStorage.setItem("skc:A","{hỏng")'); pg.reload(); open_feature(pg)
    check('JSON hỏng: thông báo, sao lưu, không xóa dữ liệu gốc khi mở', 'JSON bị hỏng' in pg.inner_text('#routine') and pg.evaluate('localStorage.getItem("skc:A:unreadable")') == '{hỏng' and pg.evaluate('localStorage.getItem("skc:A")') == '{hỏng')
    check('JSON hỏng: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- F. 3D/2D vẫn hoạt động (CDN bị chặn → dự phòng 2D) ----------
    ctx, pg, errs, dialogs = new_page(b)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); open_feature(pg)
    check('3D lỗi → thông báo + chuyển 2D', 'Đã chuyển sang chế độ 2D' in pg.inner_text('#notice') and not pg.is_hidden('#v2d'))
    pg.click('#v2d [data-z=forehead]')
    check('2D: chọn vùng Trán → highlight + thông tin vùng', pg.locator('#v2d [data-z=forehead].on').count() == 1 and 'Trán' in pg.inner_text('#info'))
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.check('#quiz input[value=hydrate]'); pg.click('[data-act=quiz]'); pg.locator('#routine li.step').first.focus(); pg.keyboard.press('Enter')
    check('Bước routine chọn được bằng bàn phím, đồng bộ 2D', pg.locator('#routine li.step.sel').count() == 1 and pg.locator('#v2d .zone.on').count() == 4)
    pg.click('#devBtn')  # 0.4.1 điều hướng: công cụ giả lập lỗi nằm sau Developer mode
    pg.click('[data-act=sim]'); pg.click('[data-act=mode][data-m="3d"]')
    check('Giả lập lỗi 3D vẫn chuyển 2D', 'lỗi 3D giả lập' in pg.inner_text('#notice') and not pg.is_hidden('#v2d'))
    check('3D/2D: không có lỗi JavaScript', errs == [], errs)
    if LIVE:
        check('Mô phỏng Live Server: script tự tải lại có mặt và không gây lỗi', pg.evaluate("[...document.scripts].some(s=>s.textContent.includes('Live reload enabled'))") and errs == [])
    ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.3.1 đạt.')
