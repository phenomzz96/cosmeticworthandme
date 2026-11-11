# Skincare Prototype 0.3.1: Ổn định, toàn vẹn dữ liệu và bảo mật

Đây là bản cập nhật bảo trì từ 0.3. Kiến trúc giữ nguyên (HTML/CSS/JS ES modules, không framework, không backend). Các file sau **không thay đổi**: `engine.js`, `rules.js`, `viewer3d.js`, `viewer2d.js`, `data.js`.

## 1. Lỗi đã xác nhận và nguyên nhân

| # | Lỗi (đã kiểm tra trên mã 0.3) | Nguyên nhân |
|---|---|---|
| 1 | `isDate('2026-02-29')`, `'2026-02-30'`, `'2026-11-31'` trả về `true` | `isDate` dùng `Date.parse()`, trong khi V8 tự "đẩy" ngày không tồn tại sang tháng sau (31/11 thành 01/12) |
| 2 | Ô Ngày 0 ghi thẳng `S.mgr.d.startDate` rồi gọi `persist()` | Không kiểm tra ngày, không qua `tx()`, lỗi ghi bị bỏ qua |
| 3 | Xóa Ngày 0 xong, lần lưu sau tự đặt lại | `save()` đặt `startDate` mỗi khi nó rỗng, thay vì chỉ ở lần áp dụng đầu tiên |
| 4 | Không có cách sửa ngày áp dụng; giao diện không phân biệt Ngày 0 với ngày áp dụng | Thiếu thao tác. **Ghi chú:** việc đổi Ngày 0 không cập nhật `applications` là *đúng thiết kế*, không phải lỗi (khác với mô tả trong yêu cầu) |
| 5 | Dữ liệu động chèn vào `innerHTML` mà không escape: tên sản phẩm/id lạ, mục tiêu quiz, cảnh báo, ảnh chụp routine, khóa ngày nhật ký, `recordedAt`… | Hàm `esc()` chỉ được gọi thủ công ở vài chỗ; `esc` không escape `'`; biểu đồ SVG chèn khóa nhật ký thẳng vào `<title>` |
| 6 | `main.js` gọi `localStorage` trực tiếp, không có try/catch | Trình duyệt chặn storage thì trang không chạy được |
| 7 | Bước chuyển đổi 0.2 và bước sao lưu JSON hỏng gọi `setItem` mà không bắt lỗi | Hết dung lượng đúng lúc mở thì trang không chạy được |
| 8 | JSON hỏng lần thứ hai không được sao lưu (bản sao lưu đầu được giữ, bản mới mất khi lưu) | `if(getItem(bk)==null)` |
| 9 | Dữ liệu schema 3 sai cấu trúc (ví dụ `versions[i]=null`) làm giao diện lỗi | `migrate` không kiểm tra cấu trúc schema 3 |
| 10 | Thao tác nhật ký (`jsave`, `pdel`, `edel`) không qua `tx()`; lỗi IndexedDB không được báo; xóa ngày khi xóa ảnh thất bại để lại ảnh "mồ côi" | Đã được ghi nhận trong HANDOVER 0.3 |
| 11 | `skc:uid` chứa giá trị lạ thì trang bị lỗi | `USERS.find()` trả về `undefined` |
| 12 | Ảnh nhật ký không giới hạn loại tệp và dung lượng; object URL không được thu hồi | Không có kiểm tra |

## 2. Giải pháp

**Ngày (`timeline.js`)**
- Regex cố định `^\d{4}-\d{2}-\d{2}$` (chữ số ASCII, không ký tự thừa), kết hợp phép tính số ngày trong tháng theo lịch Gregorian.
- Năm hợp lệ từ 0001 đến 9999.
- Không dùng `Date`, nên không bị ảnh hưởng bởi múi giờ hay DST.
- Sai kiểu dữ liệu thì trả về `false`, không ném lỗi.
- `addDays` và `daysBetween` tính trên mốc UTC 00:00; đầu vào sai thì trả về `null`.

**Ngày 0 và ngày áp dụng**
- **Ngày 0 (`startDate`)** chỉ là mốc để đếm "ngày thứ N".
  - `Manager.setStartDate()` kiểm tra ngày, chạy qua `tx()`, không đụng tới `applications`, `versions` hay `journal`.
  - Tự đặt Ngày 0 chỉ ở lần áp dụng **đầu tiên**.
- **Ngày áp dụng thực tế** lấy từ `applications[]` (chỉ thêm, không sửa).
- **Sửa ngày áp dụng** dùng `Manager.correctApplication(seq, ngày, {confirmed:true})`:
  - bắt buộc có xác nhận, ở cả giao diện (form xác nhận) và trong Manager;
  - ngày mới phải nằm giữa lần áp dụng trước và lần sau, để không đảo thứ tự lịch sử;
  - chỉ ghi thêm `{target, from, prevFrom, recordedAt, reason}` vào **`corrections[]`**, bản ghi gốc giữ nguyên;
  - timeline dùng ngày đã sửa, kèm chú thích "đã sửa từ …".
- Timeline hiển thị:
  - "Ngày bắt đầu áp dụng thực tế" và nhãn "khác Ngày 0";
  - số ngày âm ("N ngày trước Ngày 0");
  - ngày trước lần áp dụng đầu tiên hiện "Không đủ dữ liệu", không tạo routine giả.

**XSS (`html.js`, mới)**
- Template tag `` html`…` ``: **mọi** giá trị chèn vào đều được escape (`& < > " '`). Chỉ kết quả của chính `html` mới được giữ nguyên dạng HTML, và chỉ khi nằm ở vị trí văn bản.
- `html` kiểm tra ngữ cảnh của từng vị trí chèn và **ném lỗi** khi giá trị bị chèn:
  - trong thẻ mà không có ngoặc kép;
  - vào thuộc tính `on*`, `style`, `href`, `src`…;
  - vào comment hoặc `<script>`/`<style>`.

  `<title>` và `<textarea>` luôn được escape.
- `setHtml()` là đường duy nhất gán `innerHTML` trong `main.js` và `journal.js`, và chỉ nhận kết quả từ `html`.
- Trạng thái `checked` của quiz được đặt bằng DOM. Ảnh dùng `createElement` cùng `safeImageUrl()` (chỉ cho phép `blob:`), và object URL được thu hồi sau khi dùng.
- Cơ chế này "hỏng an toàn": nếu quên escape, nội dung chỉ hiện thành chữ, không thể biến thành mã chạy được.

**Lưu trữ (`storage.js`)**
- Mọi lần đọc/ghi/xóa đều đi qua `access()`, không bao giờ ném lỗi ra ngoài.
- Phân biệt các tình huống:

  | Lý do | Ý nghĩa |
  |---|---|
  | `no-access` | Không truy cập được storage |
  | `read-failed` | Không đọc được |
  | `quota` / `write-failed` | Không ghi được |
  | JSON hỏng | Dữ liệu không phải JSON hợp lệ |
  | `backup-failed` | Không tạo được bản sao lưu |
  | `invalid` | Dữ liệu sai cấu trúc |
  | `newer-schema` | Dữ liệu từ phiên bản mới hơn |

- Không bao giờ ghi khóa chính khi chưa đọc được hoặc chưa sao lưu được. Bản sao lưu được **đọc lại để xác minh**. Nếu khóa sao lưu đã có nội dung khác, bản mới dùng khóa mới.
- Không lưu bền vững được thì:
  - dữ liệu giữ trong **bộ nhớ tạm của phiên**, tách theo `userId`, nên chuyển A → B → A vẫn đúng;
  - Manager trả `persisted:false` cùng `storageError`;
  - giao diện hiện banner "Lưu trữ: chỉ tạm thời", nhãn "lưu tạm trong phiên", và **không** báo "Đã lưu".
- Lỗi do hết dung lượng hoặc lỗi ghi có nút **"Thử lưu lại vào trình duyệt"**.
- `probe()` kiểm tra khả năng ghi ngay khi mở trang.
- Lỗi IndexedDB (không khả dụng, bị chặn, giao dịch bị hủy) được báo rõ. Ảnh chỉ nhận `image/*` tối đa 5 MB.

## 3. File đã thay đổi

| File | Thay đổi |
|---|---|
| `js/timeline.js` | `isDate` mới; `addDays`/`daysBetween` an toàn; xử lý `corrections`; `correctionBounds`, `firstApplication`; `describeDay` có `dayIndex`, `firstApplied` |
| `js/storage.js` | Cơ chế lưu trữ an toàn tập trung, bộ nhớ tạm theo userId, sao lưu có xác minh, `normalize3`, `probe`/`retry`/`getPref`/`setPref` |
| `js/manager.js` | `persist`/`tx` mới (giữ thay đổi và báo `persisted:false`); `retryPersist`, `setStartDate`, `correctApplication`, `saveJournal`, `setJournalPhoto`, `deleteJournal`; quy tắc tự đặt Ngày 0 |
| `js/main.js` | Các hàm render chuyển sang `` html`…` ``/`setHtml`; banner lưu trữ; giao diện Ngày 0 và sửa ngày áp dụng; nhật ký và ảnh qua Manager, có xử lý lỗi; chọn bước bằng bàn phím; nhớ trạng thái "Lịch sử áp dụng" |
| `js/html.js` | **Mới**: dựng HTML an toàn |
| `js/journal.js` | Biểu đồ dùng `html`, bỏ qua khóa ngày không hợp lệ; IndexedDB báo lỗi đầy đủ, đóng kết nối |
| `index.html` | Thêm một dòng `<div id="storage"></div>` (banner) |
| `css/style.css` | Thêm vài lớp cho banner, form sửa ngày, chú thích biểu đồ |
| `package.json` | `version 0.3.1`; `npm test` chạy thêm `tests/v031.test.mjs` |
| `tests/manager.test.mjs` | Điều chỉnh **1 test** (A-ter), xem mục 5 |
| `tests/v031.test.mjs` | **Mới**: 29 test |
| `tests/ui031.e2e.py` | **Mới**: 43 kiểm tra giao diện (44 khi chạy với `--live`) |
| `tests/serve_like_live_server.py` | **Mới**: server mô phỏng việc Live Server chèn script |
| `README.md` | Sửa các dòng đã lỗi thời và thêm mục 0.3.1 |

**Cấu trúc dữ liệu:** vẫn là schema 3. Thêm trường tùy chọn `corrections: []`; nếu thiếu thì coi như mảng rỗng. Dữ liệu 0.3 mở được ngay, không cần chuyển đổi, và không bị ghi lại khi mở. *Nếu quay lại bản 0.3:* trường `corrections` được giữ nguyên nhưng bị bỏ qua, nên timeline sẽ hiển thị ngày áp dụng gốc (chưa sửa).

## 4. Kết quả kiểm thử (đã chạy thật trong môi trường phát triển)

| Bộ test | Kết quả |
|---|---|
| `node tests/engine.test.mjs` (cũ) | 18/18 đạt |
| `node tests/manager.test.mjs` (cũ, 1 test điều chỉnh) | 18/18 đạt |
| `node tests/v031.test.mjs` (mới) | 29/29 đạt |
| `npm test` dưới 7 múi giờ: UTC, Asia/Ho_Chi_Minh, America/New_York, America/Los_Angeles, Pacific/Chatham, Pacific/Kiritimati, Australia/Lord_Howe | đều đạt |
| `tests/ui.e2e.py` (cũ, không sửa), Chromium headless | 17/17 đạt |
| `tests/ui031.e2e.py` (mới), Chromium headless | 43/43 đạt |
| Cả hai bộ e2e qua server mô phỏng Live Server, ở thư mục gốc và thư mục con | 17/17 và 44/44 đạt |

**Chưa kiểm chứng được:**
- 3D thật: môi trường kiểm thử chặn CDN jsDelivr và npm, nên chỉ chạy được đường dự phòng 2D và nút "Giả lập lỗi 3D".
- VS Code + Live Server thật.
- Netlify.
- Firefox, Safari và thiết bị di động.

## 5. Test được điều chỉnh

`manager.test.mjs` › **A-ter**. Ở 0.3, khi ghi lỗi, Manager **hoàn tác** thay đổi (`ok:false`). Yêu cầu VI.9–10 của 0.3.1 lại đòi giữ chức năng dùng tạm trong phiên và phân biệt dữ liệu tạm với dữ liệu bền vững. Vì vậy thay đổi nay được **giữ trong bộ nhớ**, kết quả trả về `persisted:false` cùng thông báo lỗi.

Test mới vẫn kiểm tra các điểm cốt lõi của test cũ:
- lỗi được báo;
- không báo "đã lưu" sai;
- localStorage không bị ghi.

## 6. Hướng dẫn cập nhật 0.3 → 0.3.1

1. (Khuyến nghị) Sao lưu thư mục 0.3 hiện tại.
2. Giải nén `skincare-prototype-0.3.1.zip` đè lên thư mục cũ, hoặc dùng thư mục mới.
3. Mở bằng VS Code và Live Server, rồi nhấn **Ctrl+F5** để tránh dùng file JS cũ trong cache.
4. Dữ liệu trong trình duyệt (cùng địa chỉ, ví dụ `127.0.0.1:5500`) vẫn còn, không cần thao tác thêm.
5. Netlify: kéo thả thư mục đã giải nén, giống bản 0.3 (không có bước build).

## 7. Kiểm thử thủ công bằng Live Server (cần bạn thực hiện)

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1–3 | Mở thư mục trong VS Code, chuột phải `index.html`, chọn *Open with Live Server* | Trang tải được, có trang "Cửa hàng" |
| 4–5 | F12, mở tab Console | Không có lỗi đỏ; dòng "Live reload enabled." là của Live Server |
| 6–7 | "Kiến trúc sư…", chọn *Cấp ẩm*, bấm "Lưu kết quả quiz" | Routine hiện ra, nhãn "chưa lưu" |
| 8 | "Lưu routine", đổi quiz, lưu lần nữa, mở v1, bấm "Khôi phục" | "Đã lưu v1/v2", "Đã khôi phục v1", quiz trong form khớp v1 |
| 9 | Đổi ô **Ngày 0** sang ngày sớm hơn | Thông báo "chỉ là mốc tham chiếu…", nhãn "khác Ngày 0"; "Lịch sử áp dụng" giữ nguyên |
| 10 | Bấm Ngày 0/7/14/28, chọn ngày bất kỳ; mở "Lịch sử áp dụng", bấm "Sửa ngày áp dụng", thử "Hủy" rồi "Xác nhận" | Ngày dưới mỗi mốc bằng Ngày 0 + N; hủy thì không đổi gì; xác nhận thì có chú thích "đã sửa…" |
| 11 | Nhật ký: ghi chú `<b>thử</b> <img src=x onerror=alert(1)>`, Lưu | Ghi chú hiện **nguyên văn dạng chữ**, không có hộp thoại alert |
| 12 | F5 | Quiz, phiên bản, nhật ký vẫn còn; ghi chú vẫn là chữ |
| 13 | Đổi "Tài khoản thử nghiệm" A ↔ B | Dữ liệu tách riêng |
| 14 | Chế độ 3D: kéo, cuộn, bấm vùng mặt | Xoay/zoom được, vùng sáng lên, phần thông tin cập nhật (**chưa kiểm chứng tự động**) |
| 15 | Bấm "2D", bấm vùng; bật "Giả lập lỗi 3D" rồi bấm "3D" | 2D hoạt động; có thông báo lỗi 3D và tự chuyển 2D |
| 16 | Console: `Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};` rồi lưu routine hoặc nhật ký. Sau đó F5 (hàm giả mất), thử lại | Banner đỏ "chỉ tạm thời", thông báo "chỉ lưu tạm", không có "Đã lưu"; nút "Thử lưu lại". Sau F5 trang chạy bình thường; thay đổi chưa lưu không còn, đúng như thông báo |

Muốn thử trường hợp storage bị chặn hoàn toàn: dùng cửa sổ ẩn danh và chặn cookie/dữ liệu trang trong cài đặt trình duyệt, hoặc chạy `tests/ui031.e2e.py`.

## 8. Rà soát bảo mật tĩnh (các file đã sửa và toàn bộ `js/`, `index.html`, `css/`)

| Hạng mục | Kết quả |
|---|---|
| Bí mật, API key, token, mật khẩu | Không có |
| URL / kết nối mạng | Chỉ `cdn.jsdelivr.net` (Three.js 0.160.0, có từ 0.3); không có `fetch`, XHR, WebSocket, beacon hay analytics |
| Mã thực thi động | Không có `eval`, `new Function`, `setTimeout` dạng chuỗi, `document.write`, `insertAdjacentHTML`, `outerHTML` |
| `innerHTML` | Chỉ trong `setHtml()` (`html.js`) và trong SVG hằng số của `viewer2d.js` (không có dữ liệu động) |
| Bộ điều phối sự kiện | Chỉ gọi hàm có thật trong bảng `act` (`Object.hasOwn`), nên giá trị như `data-act="constructor"` không gọi được gì |
| Lưu trữ | Mọi truy cập đi qua `storage.js`; không xóa dữ liệu; sao lưu có xác minh |
| Thay đổi ngoài phạm vi | Không có; Engine, quy tắc, 3D/2D, dữ liệu mẫu giữ nguyên |

**Rủi ro còn lại (chưa sửa ở bản này):**
1. **Không có CSP và Subresource Integrity cho Three.js** (`index.html`).
   - Mức độ: *trung bình* khi triển khai công khai. Nếu CDN bị xâm phạm, mã lạ sẽ chạy với quyền của trang.
   - Hướng khắc phục: bundle Three.js vào dự án, hoặc thêm CSP qua file `_headers` của Netlify (cần hash cho importmap).
   - Lý do chưa làm: CSP dạng thẻ meta sẽ chặn script do Live Server chèn vào, nên cần thử nghiệm riêng.
2. **Ảnh và nhật ký không mã hóa** trong IndexedDB và localStorage.
   - Mức độ: *trung bình* (dữ liệu nhạy cảm trên máy dùng chung). Đây là giới hạn đã biết của một prototype chỉ có frontend.
3. Bộ kiểm tra ngữ cảnh trong `html.js` là bộ phân tích gọn, đủ cho các template của dự án, **không** phải một trình phân tích HTML đầy đủ.

Kết luận này chỉ dựa trên phân tích mã nguồn và kiểm thử tự động. Nó **không** chứng minh ứng dụng hay máy tính an toàn tuyệt đối.

## 9. Vấn đề còn tồn tại

- 3D thật, Live Server thật, Netlify, Firefox/Safari/di động: **chưa kiểm chứng**.
- Dữ liệu ở chế độ lưu tạm mất khi tải lại trang (đúng thiết kế, có cảnh báo). Nếu ảnh đã vào IndexedDB nhưng mục nhật ký chỉ ở bộ nhớ tạm, ảnh có thể thành "mồ côi" sau khi tải lại.
- Các khóa sao lưu (`:backup-0.2`, `:unreadable*`, `:backup-invalid*`) chưa có giao diện xem hoặc dọn dẹp.
- Ảnh trong IndexedDB vẫn không nằm trong bản sao lưu localStorage.
- `viewer3d.js` (không đổi): bấm "3D" nhiều lần khi Three.js đang tải có thể tạo trùng renderer; `dispose` chưa giải phóng geometry/material.
- `rules.js` (không đổi): `toner` và `moisturizer` cùng hiển thị "Dưỡng ẩm"; bộ quy tắc vẫn chưa được chuyên gia duyệt.
- Phiên bản lên lịch ở tương lai vẫn chặn việc áp dụng phiên bản mới trước ngày đó (chính sách append-only, cần bạn quyết định).
- Nhật ký chưa liên kết với phiên bản; các mốc chưa có cấu hình bước theo giai đoạn.
