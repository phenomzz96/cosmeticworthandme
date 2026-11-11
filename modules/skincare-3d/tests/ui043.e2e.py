# Kiểm thử giao diện 0.4.3 – Timeline tối giản (cần Python + Playwright + Chromium; không cần Three.js: CDN bị chặn → mô hình tự chuyển 2D).
#   python -m http.server 8000                        (trong thư mục dự án)
#   python tests/ui043.e2e.py http://localhost:8000
# Bao phủ: bốn mốc, chọn ngày bất kỳ, routine đúng theo ngày (quá khứ/hôm nay/tương lai/trống), bản nháp, bàn phím, mobile không tràn ngang,
# đổi ngày bắt đầu theo dõi không sửa lịch sử, sửa ngày áp dụng chỉ khi xác nhận, đổi tài khoản, XSS.
import sys, json, datetime
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]
URL = args[0] if args else 'http://localhost:8000'
BASE = URL.rstrip('/') + '/'
ok = 0
def check(name, cond, extra=''):
    global ok
    if not cond: raise AssertionError(f'{name} {extra}')
    ok += 1; print('✓', name)

TODAY = datetime.date.today()
D = lambda n: (TODAY + datetime.timedelta(days=n)).isoformat()
F = lambda n: (TODAY + datetime.timedelta(days=n)).strftime('%d/%m/%Y')
S = lambda n: (TODAY + datetime.timedelta(days=n)).strftime('%d/%m')  # ngày ngắn dưới mỗi mốc
RV = 'DEMO-0.2 (quy tắc minh họa, chưa được chuyên gia kiểm duyệt)'
def snap(name): return {"status": "ready", "steps": [{"id": "am:cleanse", "period": "am", "name": name, "products": [{"id": "p01", "name": "Gel rửa mặt dịu nhẹ Lumi"}]}]}
def ver(i, n, name, applied): return {"id": f"v-{i}", "n": n, "createdAt": D(-10) + "T05:00:00Z", "quiz": {"goals": ["hydrate"], "skin": "dry"}, "quizKnown": True,
    "selection": ["p01", "p03", "p04", "p05", "p08", "p10"], "rulesVersion": RV, "snapshot": snap(name), "note": "", "change": "thử", "appliedFrom": applied, "basisId": None, "legacy": None}
# v1 áp dụng từ 10 ngày trước; v2 đã lên lịch áp dụng từ 5 ngày tới. Nhật ký: 3 ngày trước có ghi, 2 ngày trước không có.
SEED = {"schema": 3, "quiz": {"goals": ["hydrate"], "skin": "dry"}, "selection": ["p01", "p03", "p04", "p05", "p08", "p10"],
  "versions": [ver(1, 1, "Bước V1", D(-10)), ver(2, 2, "Bước V2", D(5))],
  "applications": [{"versionId": "v-1", "from": D(-10), "recordedAt": D(-10) + "T05:00:00Z", "kind": "save"}, {"versionId": "v-2", "from": D(5), "recordedAt": D(-10) + "T06:00:00Z", "kind": "save"}],
  "corrections": [], "journal": {D(-3): {"dry": 2, "oil": 1, "irr": 0, "skipped": True, "note": "da hơi khô"}}, "startDate": D(-10), "basisId": "v-2"}
X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">'
X2 = '"><svg onload="window.__xss=(window.__xss||0)+1"></svg>'

def page(b, w=1366, h=900, touch=False, seed=SEED, uid='A'):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []; dialogs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
    pg.route('**/cdn.jsdelivr.net/**', lambda r: r.abort())
    pg.goto(BASE)
    pg.evaluate('([d,u])=>{localStorage.clear();if(d)localStorage.setItem("skc:"+u,JSON.stringify(d));localStorage.setItem("skc:uid",u)}', [seed, uid]); pg.reload()
    pg.click('nav [data-v=feature]')
    return ctx, pg, errs, dialogs
def goto_tab(pg, t):
    pg.click('#trackBtn'); pg.click(f'#stage-track [data-act=tab][data-t={t}]')
store = lambda pg, u='A': pg.evaluate('u=>JSON.parse(localStorage.getItem("skc:"+u))', u)
tl = lambda pg: pg.inner_text('#timeline')
no_hscroll = lambda pg: pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
pressed = lambda pg: pg.eval_on_selector_all('#timeline .tl-node', 'e=>e.map(x=>x.getAttribute("aria-pressed"))')

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 1. Màn hình chính gọn, bốn mốc, theo từng kích thước ----------
    for W, touch in [(1440, False), (768, False), (390, True)]:
        ctx, pg, errs, _ = page(b, W, 900 if W > 500 else 800, touch)
        goto_tab(pg, 'timeline'); T = f'[{W}px]'; t = tl(pg)
        check(f'{T} tiêu đề "Lộ trình chăm sóc da" và đúng bốn mốc Bắt đầu / Tuần 1 / Tuần 2 / Tuần 4', 'Lộ trình chăm sóc da' in t and pg.eval_on_selector_all('#timeline .tl-node b', 'e=>e.map(x=>x.textContent)') == ['Bắt đầu', 'Tuần 1', 'Tuần 2', 'Tuần 4'])
        check(f'{T} đang xem ngày bắt đầu: nêu rõ ngày, nhãn "Đã qua", "Ngày bắt đầu theo dõi"', F(-10) in t and 'Đã qua' in t and 'Ngày bắt đầu theo dõi' in t and pressed(pg) == ['true', 'false', 'false', 'false'], pressed(pg))
        check(f'{T} chỉ MỘT khối routine + MỘT khối nhật ký (không lặp nhiều bản)', pg.locator('#timeline .tlbox').count() == 2 and pg.locator('#timeline .tlbox.past').count() == 1)
        check(f'{T} không còn đoạn giải thích "Ngày 0…" dài, không lộ trường kỹ thuật', not any(x in t for x in ['Ngày 0', 'chỉ dùng để đếm', 'recordedAt', 'recordedFrom', 'seq', 'ghi lúc', 'Lịch sử áp dụng']) and len(t) < 700, len(t))
        check(f'{T} khu "Tùy chỉnh mốc theo dõi" thu gọn, ô chỉnh ngày bắt đầu chưa hiện', not pg.evaluate("document.querySelector('#tlCustom').open") and not pg.locator('#startDate').is_visible())
        check(f'{T} không cuộn ngang', no_hscroll(pg))
        nodes = pg.eval_on_selector_all('#timeline .tl-node', 'e=>e.map(x=>{const r=x.getBoundingClientRect();return [r.left,r.right,r.height]})')
        check(f'{T} bốn mốc nằm trọn trong màn hình, vùng chạm ≥ 44px', all(l >= 0 and r <= W and h >= 44 for l, r, h in nodes), nodes)
        check(f'{T} không có lỗi JavaScript', errs == [], errs)
        ctx.close()

    # ---------- 2. Chọn từng mốc: routine đúng theo ngày ----------
    ctx, pg, errs, _ = page(b)
    goto_tab(pg, 'timeline')
    pg.click('[data-act=day][data-n="7"]'); t = tl(pg)
    check('Tuần 1 (quá khứ, có nhật ký): routine đã áp dụng v1 + nhật ký đúng số liệu đã ghi', pressed(pg) == ['false', 'true', 'false', 'false'] and F(-3) in t and 'Routine đã áp dụng' in t and 'Bước V1' in t and 'Bước V2' not in t and 'Khô 2/5 · Dầu 1/5 · Kích ứng 0/5 · không dùng đủ bước' in t and 'da hơi khô' in t, t[:400])
    pg.click('[data-act=day][data-n="14"]'); t = tl(pg)
    check('Tuần 2 (tương lai, chưa có lịch mới): bản tham khảo có điều kiện, ghi rõ không phải dữ liệu thực tế', F(4) in t and 'Sắp tới' in t and 'Tham khảo (chưa phải dữ liệu thực tế)' in t and 'Đây không phải dữ liệu sử dụng thực tế' in t, t[:500])
    check('Tuần 2: chỉ một danh sách routine (v1), không hiện song song "đang áp dụng" và "dự kiến"', t.count('Bước V1') == 1 and 'Bước V2' not in t and 'Ngày này chưa tới' in t)
    pg.click('[data-act=day][data-n="28"]'); t = tl(pg)
    check('Tuần 4 (tương lai, đã có lịch v2): hiển thị lịch đã ghi nhận, ghi rõ chưa phải dữ liệu sử dụng thực tế', F(18) in t and 'Đã lên lịch áp dụng' in t and 'Bước V2' in t and 'Bước V1' not in t and 'chưa phải dữ liệu sử dụng thực tế' in t, t[:400])
    pg.click('[data-act=day][data-n="0"]'); t = tl(pg)
    check('Bắt đầu: quay lại ngày bắt đầu, nút đúng được đánh dấu', pressed(pg) == ['true', 'false', 'false', 'false'] and F(-10) in t and 'Bước V1' in t)

    # ---------- 3. Chọn ngày bất kỳ ----------
    pg.fill('#tlDate', D(0)); pg.dispatch_event('#tlDate', 'change'); t = tl(pg)
    check('Hôm nay: routine đang áp dụng; không mốc nào được chọn sai', 'Hôm nay' in t and 'Routine đang áp dụng' in t and 'Bước V1' in t and pressed(pg) == ['false'] * 4, pressed(pg))
    pg.fill('#tlDate', D(-30)); pg.dispatch_event('#tlDate', 'change'); t = tl(pg)
    check('Ngày trước lần áp dụng đầu tiên: trống trung thực, không routine giả, nêu ngày bắt đầu áp dụng', 'Chưa có routine nào được ghi nhận áp dụng vào ngày này' in t and f'trước khi bạn bắt đầu áp dụng ({F(-10)})' in t and 'Bước V1' not in t and 'Chưa có nhật ký cho ngày này' in t)
    pg.fill('#tlDate', D(60)); pg.dispatch_event('#tlDate', 'change'); t = tl(pg)
    check('Ngày xa trong tương lai: bản tham khảo (hoặc lịch đã ghi), không số liệu sử dụng', 'Sắp tới' in t and ('Tham khảo' in t or 'Đã lên lịch' in t) and 'Ngày này chưa tới' in t and '/5' not in t)
    pg.fill('#tlDate', D(-3)); pg.dispatch_event('#tlDate', 'change')
    check('Chọn ngày trùng một mốc → mốc đó được đánh dấu', pressed(pg) == ['false', 'true', 'false', 'false'], pressed(pg))

    # ---------- 4. Bản nháp chưa lưu ----------
    pg.click('#stepper [data-s=routine]'); pg.click('#editBox > summary'); pg.click('#editBox [data-act=rm] >> nth=0')
    goto_tab(pg, 'timeline'); pg.click('[data-act=day][data-n="0"]')
    check('Ngày quá khứ: không hiện ghi chú bản nháp', 'chưa lưu' not in tl(pg))
    pg.fill('#tlDate', D(0)); pg.dispatch_event('#tlDate', 'change'); t = tl(pg)
    check('Hôm nay có bản nháp: một dòng ngắn (không thẻ routine thứ hai), có đường dẫn tới routine', 'Bạn có thay đổi chưa lưu nên chưa được tính vào lộ trình' in t and pg.locator('#timeline .tlbox').count() == 2 and pg.locator('#timeline .tl-draft [data-act=stage]').count() == 1)
    ctx.close()

    # ---------- 5. Bàn phím ----------
    ctx, pg, errs, _ = page(b)
    goto_tab(pg, 'timeline')
    pg.focus('[data-act=day][data-n="14"]'); pg.keyboard.press('Enter')
    check('Enter trên mốc → chọn mốc, tiêu điểm vẫn ở mốc đó sau khi vẽ lại', pressed(pg) == ['false', 'false', 'true', 'false'] and pg.evaluate("document.activeElement.dataset.n") == '14', pressed(pg))
    pg.focus('[data-act=day][data-n="28"]'); pg.keyboard.press('Space')
    check('Space trên mốc → chọn mốc', pressed(pg) == ['false', 'false', 'false', 'true'])
    pg.focus('#tlCustom > summary'); pg.keyboard.press('Enter')
    check('Enter trên "Tùy chỉnh mốc theo dõi" mở khu; thấy ô ngày và câu giải thích ngắn', pg.evaluate("document.querySelector('#tlCustom').open") and pg.locator('#startDate').is_visible() and 'Đổi mốc theo dõi không thay đổi lịch sử đã lưu.' in tl(pg))
    pg.keyboard.press('Space')
    check('Space trên summary đóng lại', not pg.evaluate("document.querySelector('#tlCustom').open"))
    check('Bàn phím: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 6. Đổi ngày bắt đầu theo dõi: lịch sử KHÔNG đổi ----------
    ctx, pg, errs, _ = page(b)
    goto_tab(pg, 'timeline'); before = store(pg)
    pg.click('#tlCustom > summary'); pg.fill('#startDate', D(-20)); pg.dispatch_event('#startDate', 'change'); t = tl(pg); after = store(pg)
    check('Đổi ngày bắt đầu theo dõi: thông báo ngắn, các mốc dịch theo', 'Đã đổi ngày bắt đầu theo dõi. Lịch sử đã lưu không thay đổi.' in t and F(-20) in t and pg.eval_on_selector_all('#timeline .tl-node small', 'e=>e.map(x=>x.textContent)') == [S(-20), S(-13), S(-6), S(8)])
    check('Đổi ngày bắt đầu theo dõi: applications, corrections, versions, journal GIỮ NGUYÊN trong bộ nhớ', all(after[k] == before[k] for k in ['applications', 'corrections', 'versions', 'journal', 'basisId']) and after['startDate'] == D(-20))
    check('Khu "Tùy chỉnh" vẫn mở sau khi vẽ lại (kể cả khi thao tác nhanh)', pg.evaluate("document.querySelector('#tlCustom').open"))
    check('Hai ngày khác nhau: lưu ý ngắn luôn hiện ngoài khu thu gọn, không che sự khác biệt', f'Ngày bắt đầu theo dõi ({F(-20)}) khác ngày bắt đầu áp dụng routine ({F(-10)})' in t and pg.locator('#timeline .tl-differ').is_visible())
    pg.click('#tlCustom > summary'); pg.click('.tl-differ [data-act=opentl]'); pg.wait_for_timeout(200)
    check('"Xem giải thích" mở khu Tùy chỉnh + phần giải thích, đưa tiêu điểm tới đó', pg.evaluate("document.querySelector('#tlCustom').open&&document.querySelector('#tlWhy').open") and 'không tự đồng bộ hay ghi đè lịch sử' in tl(pg) and pg.evaluate("document.activeElement.parentElement.id") == 'tlCustom')
    check('Khác ngày: có thẻ "khác ngày bắt đầu theo dõi" + ngày áp dụng thực tế trong khu Tùy chỉnh', f'Routine thực tế bắt đầu áp dụng từ {F(-10)}' in tl(pg) and 'khác ngày bắt đầu theo dõi' in tl(pg))
    pg.fill('#startDate', ''); pg.dispatch_event('#startDate', 'change'); t = tl(pg); after = store(pg)
    check('Bỏ ngày bắt đầu theo dõi: lịch sử giữ nguyên, không tự đặt lại, các mốc không còn ngày', after['startDate'] is None and after['applications'] == before['applications'] and 'Đã bỏ ngày bắt đầu theo dõi' in t and pg.locator('#timeline .tl-node small').count() == 0 and 'Chưa có ngày bắt đầu theo dõi' in t)
    pg.click('[data-act=day][data-n="7"]')
    check('Không có ngày bắt đầu: chọn mốc không bịa ngày/routine', 'Chưa có ngày bắt đầu theo dõi' in tl(pg) and 'Bước V1' not in tl(pg))
    pg.fill('#tlDate', D(-3)); pg.dispatch_event('#tlDate', 'change')
    check('Không có ngày bắt đầu nhưng vẫn chọn được ngày bất kỳ: routine + nhật ký đúng', 'Bước V1' in tl(pg) and 'da hơi khô' in tl(pg))
    check('Đổi mốc: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 7. Sửa ngày áp dụng: nằm ở tab Phiên bản, chỉ khi xác nhận ----------
    ctx, pg, errs, _ = page(b)
    goto_tab(pg, 'timeline'); before = store(pg)
    check('Timeline không còn công cụ sửa lịch sử', pg.locator('#timeline [data-act=fix]').count() == 0 and 'Sửa ngày áp dụng' not in pg.inner_text('#timeline'))
    goto_tab(pg, 'versions')
    check('Tab Phiên bản có "Lịch sử áp dụng (2)" thu gọn', 'Lịch sử áp dụng (2)' in pg.inner_text('#versions') and not pg.evaluate("document.querySelector('#versions details.hist').open"))
    pg.click('#versions details.hist > summary'); pg.locator('#versions [data-act=fix] >> nth=1').click()
    check('Bấm "Sửa ngày áp dụng" chỉ mở biểu mẫu: nêu rõ hậu quả, CHƯA ghi gì', 'Bạn đang sửa lịch sử áp dụng thực tế' in pg.inner_text('#versions') and 'Bản ghi gốc vẫn được giữ' in pg.inner_text('#versions') and 'Phiên bản, nhật ký và ngày bắt đầu theo dõi không thay đổi' in pg.inner_text('#versions') and store(pg)['corrections'] == [])
    pg.fill('#fixDate', D(-12)); pg.click('[data-act=fixno]')
    check('Hủy → lịch sử không đổi, có thông báo', store(pg) == before and 'Đã hủy, lịch sử áp dụng không thay đổi.' in pg.inner_text('#versions'))
    pg.locator('#versions [data-act=fix] >> nth=1').click(); pg.fill('#fixDate', D(-12)); pg.fill('#fixReason', 'bắt đầu sớm hơn'); pg.click('[data-act=fixok]')
    after = store(pg)
    check('Xác nhận → chỉ GHI THÊM bản ghi sửa; bản ghi gốc, phiên bản, nhật ký, ngày bắt đầu theo dõi nguyên vẹn', after['applications'] == before['applications'] and after['versions'] == before['versions'] and after['journal'] == before['journal'] and after['startDate'] == before['startDate'] and len(after['corrections']) == 1 and after['corrections'][0]['from'] == D(-12) and after['corrections'][0]['prevFrom'] == D(-10))
    check('Thông báo hậu quả hiện ngay tại tab Phiên bản', 'Đã sửa ngày áp dụng' in pg.inner_text('#versions') and 'lộ trình đã được tính lại' in pg.inner_text('#versions'))
    goto_tab(pg, 'timeline'); pg.fill('#tlDate', D(-12)); pg.dispatch_event('#tlDate', 'change'); t = tl(pg)
    check('Timeline tính lại theo ngày đã sửa; vẫn báo (ngắn) rằng ngày áp dụng đã được chỉnh, không lộ trường kỹ thuật', 'Routine đã áp dụng' in t and 'Bước V1' in t and 'ngày áp dụng đã được chỉnh' in t and 'recordedFrom' not in t and 'prevFrom' not in t)
    check('Sửa ngày: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 8. Đổi tài khoản & dữ liệu trống ----------
    ctx, pg, errs, _ = page(b)
    goto_tab(pg, 'timeline'); check('User A: có dữ liệu', 'Bước V1' in tl(pg))
    pg.select_option('#userSel', 'B'); goto_tab(pg, 'timeline'); t = tl(pg)
    check('Đổi sang User B: không thấy routine/nhật ký/ngày của A; trống trung thực', 'Bước V1' not in t and 'da hơi khô' not in t and 'Chưa có ngày bắt đầu theo dõi' in t and pg.locator('#timeline .tl-node small').count() == 0)
    pg.fill('#tlDate', D(0)); pg.dispatch_event('#tlDate', 'change'); t = tl(pg)
    check('User B chọn hôm nay: "Chưa có routine nào đang được áp dụng"; không tự tạo số liệu', 'Chưa có routine nào đang được áp dụng' in t and '/5' not in t and 'cải thiện' not in t)
    pg.select_option('#userSel', 'A'); goto_tab(pg, 'timeline')
    check('Quay lại A: dữ liệu còn nguyên', 'Bước V1' in tl(pg))
    check('Đổi tài khoản: không có lỗi JavaScript', errs == [], errs)
    ctx.close()

    # ---------- 9. XSS (dữ liệu độc hại đã lưu hiển thị thành chữ) ----------
    bad = json.loads(json.dumps(SEED))
    bad['journal'][D(-3)]['note'] = X + X2; bad['journal'][D(-3)]['dry'] = X
    bad['versions'][0]['snapshot']['steps'][0]['name'] = X; bad['versions'][0]['snapshot']['steps'][0]['products'][0]['name'] = X2; bad['versions'][0]['rulesVersion'] = X
    bad['corrections'] = [{"target": 0, "from": D(-11), "prevFrom": D(-10), "recordedAt": D(-9) + "T00:00:00Z", "reason": X2}]
    ctx, pg, errs, dialogs = page(b, seed=bad)
    goto_tab(pg, 'timeline'); pg.fill('#tlDate', D(-3)); pg.dispatch_event('#tlDate', 'change'); pg.click('#tlCustom > summary'); pg.fill('#startDate', D(-4)); pg.dispatch_event('#startDate', 'change')
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    t = tl(pg)
    check('XSS: nhật ký/tên bước/ghi chú hiện thành chữ trên Timeline', X in t and X2.strip() in t)
    check('XSS: không thực thi mã, không dialog', pg.evaluate('window.__xss') is None and dialogs == [])
    check('XSS: không thuộc tính on*, không thẻ img/svg lạ trong Timeline', pg.evaluate("[...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>/^on/i.test(a.name))).length") == 0 and pg.evaluate("document.querySelectorAll('img[src=x],#timeline svg:not(.ic)').length") == 0)
    goto_tab(pg, 'versions'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    check('XSS: lý do sửa ngày hiện thành chữ ở tab Phiên bản', X2.strip() in pg.inner_text('#versions') and pg.evaluate('window.__xss') is None)
    check('XSS: không có lỗi JavaScript', errs == [], errs)
    ctx.close()
    b.close()
print(f'\n{ok} kiểm thử giao diện 0.4.3 đạt.')
