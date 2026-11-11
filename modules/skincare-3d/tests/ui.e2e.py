# Kiểm thử giao diện (tùy chọn): cần Python + Playwright + Chrome.
#   python -m http.server 8000   (trong thư mục dự án)
#   python tests/ui.e2e.py http://localhost:8000
# Chặn CDN Three.js để kết quả ổn định (trang tự chuyển sang 2D).
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000'
EXE = sys.argv[2] if len(sys.argv) > 2 else None
ok = 0
def check(name, cond):
    global ok
    if not cond: raise AssertionError(name)
    ok += 1; print('✓', name)
OLD = {"quiz": {"at": "2026-10-20T01:00:00.000Z", "goals": ["hydrate"], "skin": "dry"}, "selection": ["p01","p03","p08","p10"],
       "versions": [{"n": 1, "at": "2026-10-20T01:05:00.000Z", "selection": ["p01","p03","p04","p08","p10"], "note": "đầu", "change": "thêm: — | bỏ: —"}],
       "journal": {"2026-10-21": {"dry": 2, "oil": 1, "irr": 0, "skipped": False, "note": "ok"}}, "startDate": "2026-10-20"}
# 0.4.1: giao diện chia 3 giai đoạn + khu "Theo dõi & lịch sử". Chỉ THÊM bước điều hướng (dòng đánh dấu "# 0.4.1 điều hướng")
# và đổi nơi đọc danh sách phiên bản (#routine → #versions, vì danh sách đã chuyển sang tab Phiên bản). Không đổi điều kiện kiểm tra.
def stage(pg, s):  # 0.4.1 điều hướng
    pg.click('#trackBtn' if s == 'track' else f'#stepper [data-s={s}]')
def tab(pg, t):  # 0.4.1 điều hướng
    stage(pg, 'track'); pg.click(f'#stage-track [data-act=tab][data-t={t}]')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE) if EXE else p.chromium.launch()
    pg = b.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/**', lambda r: r.abort())
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload()
    routine = lambda: pg.inner_text('#routine')
    pg.click('nav [data-v=feature]')
    pg.check('#quiz input[value=hydrate]'); pg.check('#quiz input[value=dry]'); pg.click('[data-act=quiz]')
    check('chưa lưu trước phiên bản đầu', 'chưa lưu' in routine())
    pg.click('[data-act=save]')
    check('lưu v1 → "đã lưu"', 'đã lưu' in routine() and 'Đã lưu v1' in routine())
    stage(pg, 'goals')  # 0.4.1 điều hướng
    pg.uncheck('#quiz input[value=hydrate]'); pg.check('#quiz input[value=oil]'); pg.click('[data-act=quiz]')
    check('đổi quiz → "chưa lưu"', 'chưa lưu' in routine())
    pg.click('[data-act=save]')
    check('lưu v2', 'Đã lưu v2' in routine())
    ids = pg.eval_on_selector_all('[data-act=restore]', 'els=>els.map(e=>e.dataset.id)')
    check('hai phiên bản, mã khác nhau', len(ids) == 2 and ids[0] != ids[1])
    tab(pg, 'versions')  # 0.4.1 điều hướng
    pg.click(f'details.ver:has([data-id="{ids[1]}"]) > summary')  # mở mục v1 (danh sách mới nhất trước)
    pg.click(f'[data-act=restore][data-id="{ids[1]}"]')
    check('khôi phục v1: quiz trong form được nạp lại', pg.is_checked('#quiz input[value=hydrate]') and not pg.is_checked('#quiz input[value=oil]') and pg.is_checked('#quiz input[value=dry]'))
    check('khôi phục v1: không "chưa lưu"', 'chưa lưu' not in routine() and 'Đã khôi phục v1' in routine())
    tab(pg, 'timeline')  # 0.4.1 điều hướng
    tl = pg.inner_text('#timeline')
    # 0.4.3: lịch sử áp dụng chuyển sang tab Phiên bản; Timeline chỉ hiện routine của ngày được chọn
    check('timeline hôm nay: đang áp dụng v1; lịch sử áp dụng (3) nằm ở tab Phiên bản', 'Routine đang áp dụng' in tl and 'v1' in tl and 'Lịch sử áp dụng (3)' in pg.inner_text('#versions'))
    pg.fill('#tlDate', '2020-01-01'); pg.dispatch_event('#tlDate', 'change')
    check('ngày quá khứ không có lịch sử → trống trung thực (0.4.3: câu mới)', 'Chưa có routine nào được ghi nhận áp dụng vào ngày này' in pg.inner_text('#timeline'))
    pg.reload(); pg.click('nav [data-v=feature]')
    check('sau reload: vẫn 2 phiên bản, v1 đang nạp, quiz đúng', pg.locator('[data-act=restore]').count() == 2 and pg.is_checked('#quiz input[value=hydrate]') and 'đã lưu' in routine())
    pg.select_option('#userSel', 'B')
    check('User B: không có phiên bản của A', 'Chưa có phiên bản nào' in pg.inner_text('#versions') and not pg.is_checked('#quiz input[value=hydrate]'))
    pg.select_option('#userSel', 'A')
    check('quay lại A: lịch sử còn nguyên', pg.locator('[data-act=restore]').count() == 2)
    pg.evaluate('d=>{localStorage.clear();localStorage.setItem("skc:A",JSON.stringify(d))}', OLD); pg.reload(); pg.click('nav [data-v=feature]')
    r = routine() + pg.inner_text('#versions')  # 0.4.1: nhãn "dữ liệu 0.2" nằm ở danh sách phiên bản (tab Phiên bản)
    check('dữ liệu 0.2: chuyển đổi + thông báo + đánh dấu thiếu', 'Đã chuyển đổi dữ liệu từ prototype 0.2' in r and 'dữ liệu 0.2' in r)
    check('dữ liệu 0.2: có bản sao lưu', pg.evaluate('localStorage.getItem("skc:A:backup-0.2")') is not None)
    tab(pg, 'timeline')  # 0.4.1 điều hướng
    pg.fill('#tlDate', '2026-10-21'); pg.dispatch_event('#tlDate', 'change'); tl = pg.inner_text('#timeline')
    check('dữ liệu 0.2: timeline báo chưa có dữ liệu áp dụng nhưng vẫn hiện nhật ký thật', 'Chưa có routine nào được ghi nhận áp dụng vào ngày này' in tl and 'Khô 2/5' in tl)
    stage(pg, 'model'); pg.wait_for_selector('#v2d:not([hidden])')  # 0.4.1 điều hướng (3D chỉ khởi tạo ở bước Mô hình)
    check('3D lỗi (CDN bị chặn) → chuyển 2D', not pg.is_hidden('#v2d'))
    check('không có lỗi JavaScript', errors == []) if not errors else print('Lỗi:', errors) or check('không có lỗi JavaScript', False)
    b.close()
print(f'\n{ok} kiểm thử giao diện đạt.')
