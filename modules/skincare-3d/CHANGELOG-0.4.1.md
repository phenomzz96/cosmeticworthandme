# Skincare Prototype 0.4.1 – Mô hình 3D mới & giao diện tối giản

Bản nâng cấp chất lượng trên mã 0.4. Không thêm tính năng nghiệp vụ, không đổi Engine, bộ quy tắc, Manager, Storage,
Timeline, Journal hay định dạng dữ liệu (vẫn schema 3, dữ liệu 0.3.1/0.4 mở được ngay, không chuyển đổi).

Ảnh kiểm tra nằm trong `docs/screenshots/`.

---

## 1. Vì sao mô hình 0.4 trông méo

Mô hình 0.4 (`js/face3d.js`) là một **lưới cầu kinh độ/vĩ độ được “nắn” bằng công thức**:
elip sọ → các hệ số thu hẹp hàm/đẩy mặt ra trước → **18 khối lồi/lõm Gaussian** (hốc mắt, gò mày, gò má, má, đầu mũi,
cánh mũi, môi, cằm, góc hàm…) + một hàm sống mũi. Cách này có 5 vấn đề gốc:

1. **Không có cấu trúc giải phẫu.** Mỗi nét mặt là một “cục” cộng thêm theo hướng tâm, không có mặt phẳng má, đường hàm hay
   lỗ mũi thật. Các cục chồng lên nhau và cộng dồn: má phồng, mũi thành khối tròn, cằm và góc hàm bị kéo theo.
2. **Hàng chục tham số phụ thuộc nhau.** Sửa một chỗ (ví dụ cằm) làm lệch chỗ khác (môi, hàm). Mỗi lần tinh chỉnh lại sinh
   méo mới. Thêm đỉnh không giải quyết được, vì cái sai nằm ở **hình dạng do công thức tạo ra**, không nằm ở độ mịn.
3. **Lưới cầu không hợp với khuôn mặt.** Mật độ đỉnh do kinh/vĩ độ quyết định, không theo chỗ cần chi tiết (mắt, mũi, môi).
   Pháp tuyến tính từ tổng các hàm Gaussian tạo dải tối/gãy ở nơi các khối giao nhau.
4. **Nét mặt “vẽ lên”.** Mắt nhắm, lông mày, đường môi là các dải mỏng đặt nổi trên bề mặt; tai và cổ–vai là khối riêng ghép
   vào. Kết quả giống ma-nơ-canh vẽ tay hơn là một khuôn mặt.
5. **Kiểm thử không đo được thẩm mỹ.** Các bài 1a–1d (0.4) chỉ kiểm tra thứ tự nét mặt, đối xứng, không NaN. Chúng đều đạt
   trong khi mô hình vẫn méo: đúng như đặc tả 0.4.1 đã cảnh báo.

Ngoài ra, giao diện 0.4 luôn hiện **viền của 4 vùng da** trên mặt, kể cả khi chưa chọn, làm khuôn mặt trông rối hơn.

## 2. Phương pháp mới và sự đánh đổi

**Chọn mô hình được dựng hình sẵn thay vì tiếp tục nắn khối cầu.**

| Bước | Nội dung |
|---|---|
| Nguồn | Lưới cơ sở MakeHuman `base.obj` (bộ “hm08”). Đây là lưới người do họa sĩ dựng với topology tứ giác chuẩn. **CC0 1.0**: dùng, sửa, phân phối tự do. Giấy phép đã kiểm tra trong chính kho mã (đầu tệp `base.obj`, `LICENSE.md` mục C và D). Commit, SHA-256 và căn cứ được ghi trong `assets/head.LICENSE.md`. |
| Công cụ | Không có Blender trong môi trường, nên viết `tools/build-head.mjs` (Node, không thư viện ngoài). Script chạy lại được và cho cùng kết quả. |
| Xử lý | Lấy nhóm “body” → làm mịn 1 lần bằng Catmull–Clark (chỉ làm trơn đường viền, không đổi hình dạng) → cắt tượng bán thân bằng mặt cong, cắt chính xác từng tam giác rồi bịt đáy (lưới kín) → nhãn cầu trơn đặt đúng tâm mắt gốc → chuẩn hóa tỷ lệ/trục → pháp tuyến trơn → ghi GLB 2.0 kèm mốc giải phẫu. |
| Đóng gói | `assets/head.glb` nằm trong dự án (không tải từ URL ngoài): 716 KB (≈ 564 KB nếu nén gzip); da 18 537 đỉnh / 36 856 tam giác; tổng 40 016 tam giác, 3 draw call, 0 texture. |
| Hiển thị | Vật liệu mờ (roughness 0.74), màu da trung tính, ánh sáng studio dịu (key/fill/rim + hemisphere, tone mapping ACES). Mắt kiểu tượng được tô nhẹ bằng màu đỉnh (lòng trắng ngà, mống mắt nâu xám, mép mềm). |
| 2D | `tools/gen-face2d.mjs` chiếu **chính GLB** từ phía trước để vẽ đường bao. Vùng da 2D dùng **cùng công thức** với 3D, nên hai chế độ khớp nhau theo định nghĩa. |

**Hệ thống vùng da được thiết kế lại cho lưới mới** (không giữ tọa độ (u,v) của khối cầu cũ):
vùng = elip trên mặt phẳng nhìn thẳng của mô hình đã chuẩn hóa × mặt nạ “hướng ra trước” (pháp tuyến z). Mỗi đỉnh có trọng
số 0..1; ngưỡng chọn 0.5. Kiểm thử bảo đảm:

- các vùng không chồng nhau;
- vùng tránh mắt, đầu mũi, khe môi;
- hai má có số đỉnh bằng nhau;
- chọn bằng raycast trúng đúng vùng tại điểm neo;
- vùng 2D trùng vùng 3D (sai số ≤ 4 px).

**Highlight:** không viền khi chưa chọn. Vùng được chọn có **một** lớp phủ xanh nhạt mép mềm, tối đa 55% về màu nhấn, nên vẫn
thấy hình khối. Bước “toàn mặt” dùng **một** lớp phủ đều 26%, không phải 4 mảng. Không có glow, viền hay vật liệu phát sáng.

**Đánh đổi:**

- Tải lần đầu nặng hơn: thêm 716 KB, tải một lần khi vào bước Mô hình 3D và được trình duyệt cache. Mã procedural cũ chỉ ~16 KB.
- Phong cách cố định: tượng bán thân trung tính, không tóc, không lông mày, mắt tô kiểu tượng. Đổi dáng mặt cần dựng lại GLB (MakeHuman có sẵn các “target” CC0 cho việc này, nhưng chưa dùng ở bản này).
- Dựng lại mô hình cần tải `base.obj` (≈ 1,7 MB, không đóng gói). Hướng dẫn nằm trong `assets/head.LICENSE.md`.
- Vùng da vẫn là elip xấp xỉ, không phải đường bao giải phẫu chính xác. Như vậy là đủ cho mục đích minh họa “thoa ở đâu”.

**Đánh giá trực quan:** đã render thật (Chromium + WebGL phần mềm SwiftShader) ở chính diện, 45°, trái, phải, phóng to, từ dưới
lên và khi chọn trán / trán + cằm / toàn mặt (`docs/screenshots/model-contact-sheet.png`, so sánh trước/sau trong
`before-after-0.4-vs-0.4.1.png`).

Nhận xét của người làm (chủ quan, chưa có người dùng thật đánh giá): tỷ lệ đầu–cổ–vai, mũi, môi, cằm, đường hàm và tai rõ ràng
và cân đối hơn hẳn 0.4. Gương mặt trung tính và hơi “ma-nơ-canh”. Mắt tô nhẹ dễ nhận diện hơn mắt trắng nhưng vẫn là phong cách
tượng.

**Lỗi đã tìm thấy khi kiểm tra:**

- Nắp đáy bị ngược chiều, nhìn từ dưới sẽ thấy lỗ. Bài kiểm thử mới **1d′** đã phát hiện; đã sửa.
- SwiftShader + MSAA để lọt vài chấm tối 1 px trên vai. Đã khắc phục bằng màu phẳng cho nắp đáy; chưa kiểm chứng trên GPU thật.

## 3. Thay đổi UX chính

- **Ba giai đoạn thay cho 6 khu vực xếp chồng.** Thanh bước cho biết đang ở đâu và bước nào đã xong.
  1. **Mục tiêu:** câu hỏi + danh sách sản phẩm đã mua. Bảng phân tích kỹ thuật được thu gọn. Chỉ một nút chính **“Tạo routine
     của tôi”**; nếu chưa chọn mục tiêu, trang nhắc rõ.
  2. **Routine:** hai cột sáng/tối, mỗi bước có số thứ tự, tên bước, sản phẩm và mục đích. **Cảnh báo quan trọng** (thận trọng,
     xung đột, trùng lặp, thiếu bước, thiếu dữ liệu) **luôn hiện**, bấm “Vì sao?” để xem lý do. **Lưu ý in trên sản phẩm** (vd.
     “Có thể gây khô hoặc châm chích”) hiện ngay trong dòng bước. Các phần sau nằm trong phần mở rộng (đóng mặc định): Tùy chọn
     lưu, Chi tiết routine (mục tiêu, lý do trạng thái, lưu ý tham khảo, sản phẩm bị loại, giải thích, phiên bản quy tắc), Chỉnh
     sửa sản phẩm. Một nút chính **“Xem trên mô hình 3D”** và một nút “Lưu routine”. Bấm vào một bước sẽ mở bước đó trên mô hình.
  3. **Mô hình 3D:** mô hình lớn. Bên cạnh (desktop) hoặc bên dưới (mobile) là **một** danh sách bước duy nhất và thẻ giải thích
     ngắn: tên bước, sản phẩm, mục đích, **vùng thoa**, lưu ý, cảnh báo. “Xem chi tiết” chứa cách dùng.
- **“Theo dõi & lịch sử”** là khu phụ có nhãn rõ, gồm 3 tab: Nhật ký, Timeline, Phiên bản. Mọi chức năng cũ vẫn còn: sửa ngày
  áp dụng, Ngày 0, ảnh nhật ký, khôi phục phiên bản. Khôi phục xong sẽ quay về bước Routine.
- **Điều khiển mô hình:** mặc định chỉ có 3D/2D, Đặt lại góc nhìn, chọn bước. Góc má trái/phải, nút zoom và chọn vùng bằng nút
  nằm trong menu **“Thêm điều khiển”**. Menu mở ra trong luồng trang, không che mô hình. Vẫn xoay/zoom được bằng chuột hoặc
  cảm ứng.
- **Developer mode** (nút ở chân trang, hoặc `?dev`) chứa giả lập lỗi 3D và số liệu hiệu năng (FPS, geometry, draw call, tam
  giác). Mặc định tắt, không có công cụ nào bị xóa.
- **Three.js chỉ tải khi vào bước Mô hình 3D**, và dừng render khi rời bước này.
- **Nội dung ngắn hơn:** bỏ các đoạn lặp. Chỉ còn **một** ghi chú “mô hình chỉ minh họa, không dự đoán hiệu quả” dưới mô hình,
  cộng tuyên bố ở chân trang.
- **Phong cách:** ít viền, ít thẻ lồng nhau, chip/badge dùng có chừng mực. Vùng chạm ≥ 40 px cho nút chính, không cuộn ngang ở
  360–1440 px. Phần mở rộng giữ trạng thái mở khi routine vẽ lại.

## 4. Danh sách file thay đổi (so với 0.4)

| File | Thay đổi |
|---|---|
| `assets/head.glb` | **Mới:** mô hình tượng bán thân (CC0) |
| `assets/head.LICENSE.md`, `assets/CC0-1.0-MakeHuman-LICENSE.ASSETS.md` | **Mới:** nguồn, giấy phép, các bước chỉnh sửa |
| `js/head-model.js` | **Mới:** vùng da, highlight, màu môi/mắt, điểm neo vùng, đọc GLB cho Node (module thuần) |
| `js/face3d.js` | **Đã xóa** (mô hình procedural cũ) |
| `js/viewer3d.js` | Tải GLB bằng GLTFLoader; vật liệu, ánh sáng mới; bỏ viền vùng; chọn vùng theo lưới mới. Giữ nguyên API (`init/highlight/start/stop/view/zoom/resetView/projectZone/debugInfo`) |
| `js/viewer2d.js` | Sinh lại từ GLB (cùng API) |
| `js/view3d-math.js` | Điểm nhìn/khung hình cho mô hình mới (`VIEW`) |
| `js/main.js` | Điều hướng 3 bước + khu phụ, developer mode, thẻ thông tin gọn, cảnh báo luôn hiện, giữ trạng thái phần mở rộng. Logic dữ liệu không đổi |
| `index.html`, `css/style.css` | Bố cục mới |
| `tools/build-head.mjs` | **Mới:** dựng GLB từ MakeHuman |
| `tools/gen-face2d.mjs` | Sinh 2D từ GLB |
| `tests/v041.test.mjs`, `tests/ui041.e2e.py` | **Mới:** kiểm thử 0.4.1 |
| `tests/v04.test.mjs`, `tests/v031.test.mjs`, `tests/ui*.e2e.py` | Cập nhật có kiểm soát (mục 7) |
| `package.json`, `README.md`, `CHANGELOG-0.4.1.md`, `docs/screenshots/` | Phiên bản 0.4.1, tài liệu, ảnh chụp |

Không đổi: `engine.js`, `rules.js`, `manager.js`, `storage.js`, `timeline.js`, `journal.js`, `html.js`, `selection.js`,
`icons.js`, `data.js`, `tests/engine.test.mjs`, `tests/manager.test.mjs`, `tests/fixtures/`.

## 5–6. Mã nguồn và ZIP

Toàn bộ mã nguồn 0.4.1 nằm trong `skincare-prototype-0.4.1.zip`: ứng dụng, mô hình, công cụ dựng mô hình, kiểm thử, tài liệu,
ảnh chụp. Bản ZIP đã được giải nén ra thư mục mới và chạy lại toàn bộ kiểm thử trên bản giải nén đó. Log nằm trong
`docs/test-logs/`.

## 7. Kết quả kiểm thử tự động

**85 bài JavaScript cũ chạy nguyên văn trên mã 0.4.1:**

- `engine` 18/18 đạt.
- `manager` 18/18 đạt.
- `v031` 26/29 đạt. Ba bài 6a, 6b, 6d lỗi `ENOENT` vì danh sách quét còn ghi `js/face3d.js`, tệp đã xóa.
- `v04` không chạy được: tệp import `js/face3d.js`.
- Nếu tạm giữ `face3d.js`: `v04` đạt 19/20. Bài 2e lỗi vì `viewer2d.js` đã sinh lại từ GLB, còn 1a–2d chỉ kiểm tra mã cũ không
  còn được dùng.

Log: `docs/test-logs/orig85-on-041.txt` và `docs/test-logs/orig-v04-with-face3d.txt`.

**Các thay đổi trong bài cũ** (không nới ngưỡng, không xóa điều kiện):

- `v031` 6a/6b/6d: danh sách tệp cần quét đổi `js/face3d.js` → `js/head-model.js`. Phạm vi quét giữ nguyên ý nghĩa: mọi module.
- `v04` 1a–1d, 2a–2e: viết lại thành 1a′–2e′, **cùng mục đích** cho mô hình GLB.
  - 1a′: lưới hợp lệ, pháp tuyến đơn vị.
  - 1b′: tỷ lệ rộng < cao < sâu·2, nay **chặt hơn**: từng đỉnh phải có ảnh gương.
  - 1c′: thứ tự nét mặt, mũi nhô xa nhất, hốc mắt lõm, cằm không lẹm.
  - 1d′: thay cho “dải nét mặt/viền vùng” không còn tồn tại; kiểm tra bề mặt kín, đúng hướng, không tam giác suy biến.
  - 2a′–2e′: quy ước trái/phải, vùng không chồng và chỉ ở mặt trước, ngưỡng 0.5 (mũi/mắt/môi không thuộc vùng), highlight chỉ
    đổi màu vùng được chọn, 2D khớp 3D ≤ 4 px.
  - Bài 3a–5c giữ nguyên văn.
- `ui.e2e.py`, `ui031.e2e.py`, `ui04.e2e.py`:
  - chỉ **thêm bước điều hướng** (đánh dấu `# 0.4.1 điều hướng`): chuyển giai đoạn, mở tab, mở menu “Thêm điều khiển”, “Tùy
    chọn lưu”, “Chỉnh sửa sản phẩm”, bật Developer mode;
  - đổi **nơi đọc** nội dung đã chuyển chỗ: danh sách phiên bản `#routine` → `#versions`;
  - trong `ui04`, bộ chọn danh sách bước liên quan đổi `#info .rel-steps button` → `#stepPick .pickbtn.rel`, vì danh sách trùng
    lặp trong thẻ thông tin đã bỏ; chuỗi “Sản phẩm trong bước” đổi thành “Vùng thoa” (tiêu đề cũ không còn);
  - ứng dụng vẫn giữ câu “Đã chuyển sang chế độ 2D”, nên điều kiện kiểm tra cũ không phải đổi.

**Kết quả cuối** (Node 22, Chromium headless, 3D thật bằng WebGL SwiftShader):

| Bộ kiểm thử | Kết quả |
|---|---|
| `npm test` | **103/103**: 18 Engine + 18 Manager + 29 (0.3.1) + 20 (0.4) + **18 mới (0.4.1)** |
| `ui.e2e.py` | 17/17 |
| `ui031.e2e.py` | 43/43; 44/44 với `--live` qua `tests/serve_like_live_server.py` |
| `ui04.e2e.py` | 72/72 (3D thật, gồm responsive 1440/1024/768/390) |
| `ui041.e2e.py` | **63/63 mới**: luồng khách hàng đầy đủ, mỗi màn hình một nút chính, ẩn/hiện mặc định, menu không che mô hình, tab, developer mode, cảnh báo luôn thấy, 3D chỉ tải ở bước 3, không cuộn ngang ở 1440/1024/768/390/360 px, vùng chạm |

`ui041` cũng chạy đạt qua server mô phỏng Live Server.

Ghi chú môi trường:

- Ba bộ e2e phụ thuộc ngày được chạy với `TZ=UTC`. Lý do: biến `TZ=Asia/Saigon` của máy kiểm thử được Python hiểu là UTC nhưng
  Chromium hiểu là +07, nên “hôm nay” của test lệch ngày với trình duyệt. Đây không phải lỗi của ứng dụng.
- jsDelivr bị chặn trong môi trường, nên Three.js r160 (cùng phiên bản 0.160.0, gồm `GLTFLoader`) được phục vụ từ bản sao git
  qua `--three-dir`.

**Rà soát bảo mật:**

- Không có `eval`/`new Function`/`document.write`/`insertAdjacentHTML`/`outerHTML`. `innerHTML` chỉ có trong `html.js` và SVG
  hằng số của `viewer2d.js`.
- Mọi vùng giao diện mới dựng bằng `html\`…\``.
- Thử XSS trong dữ liệu ở các màn hình mới: không thực thi, không có thuộc tính `on*`.
- Nguồn mạng ngoài duy nhất vẫn là jsDelivr (Three.js). Mô hình nằm cục bộ; GLB chỉ chứa JSON + buffer nhị phân, không URI,
  không extension, không script.
- Không có bí mật hardcode, không thêm script theo dõi. `localStorage` chỉ truy cập qua `storage.js`.
- `?dev` chỉ bật thanh công cụ và móc kiểm thử, không cấp quyền gì thêm.

## 8. Ảnh chụp (`docs/screenshots/`)

- `model-contact-sheet.png`: chính diện, nghiêng 45°, trái, phải, phóng to, chọn Trán, chọn Trán + Cằm, chọn Toàn mặt.
- `before-after-0.4-vs-0.4.1.png`: mô hình 0.4 và 0.4.1, cùng góc nhìn.
- `ui-<1440|768|390>-<goals|routine|model|track>.jpg`: giao diện desktop, tablet, mobile ở cả 4 màn hình.

## 9. Chạy bằng VS Code + Live Server

1. Giải nén `skincare-prototype-0.4.1.zip`. Trong VS Code chọn **File → Open Folder…** → thư mục `skincare-prototype`.
2. Cài extension **Live Server** (Ritwick Dey). Chuột phải `index.html` → **Open with Live Server**. Trình duyệt mở
   `http://127.0.0.1:5500/`.
3. Không mở bằng cách nhấp đúp `index.html` (`file://`): ES module và việc tải `assets/head.glb` cần HTTP.
4. Cần Internet cho Three.js. Nếu mất mạng, trang báo rõ và dùng 2D.
5. Đã có bản cũ trong trình duyệt? Nhấn **Ctrl+F5** để tải lại không dùng cache. Dữ liệu cũ giữ nguyên.
6. Chạy kiểm thử: `npm test` trong terminal của VS Code (Node 18+, không cần cài gói). Kiểm thử giao diện cần Python +
   Playwright: `pip install playwright && playwright install chromium`, rồi `python tests/ui041.e2e.py http://127.0.0.1:5500`.

## 10. Giới hạn và điểm chưa xác nhận được

- **Chưa kiểm tra trên GPU thật, điện thoại thật hay Firefox/Safari.** Mọi ảnh render dùng SwiftShader, nên màu, độ mịn và hiệu
  năng trên máy thật có thể khác.
- **Chưa chạy VS Code + Live Server thật**: chỉ dùng server mô phỏng cách Live Server chèn script tự tải lại. Cũng chưa tải
  Three.js từ jsDelivr thật.
- **Đánh giá thẩm mỹ là của người làm**, chưa có khách hàng thật xem. Bài kiểm thử hình học chỉ chứng minh lưới đúng kỹ thuật
  (kín, đối xứng, đúng hướng), không chứng minh mô hình “đẹp”.
- Mô hình là tượng bán thân trung tính (không tóc, không lông mày), dáng mặc định của MakeHuman. Chưa có tùy biến dáng mặt hay
  giới tính.
- Bước “toàn mặt” phủ một lớp màu đều lên mặt. Lớp này đã để nhẹ, nhưng một số người vẫn có thể hiểu nhầm là “màu da thay đổi”;
  ghi chú dưới mô hình nói rõ là không.
- Mô hình làm trang nặng thêm 716 KB khi vào bước 3 lần đầu.
- Three.js vẫn tải từ CDN, không có Subresource Integrity (giống 0.4). Khi đưa vào sản phẩm thật nên bundle cục bộ.
- Vùng da và trường `zones` của sản phẩm vẫn là dữ liệu minh họa. Bộ quy tắc chưa được chuyên gia da liễu kiểm duyệt.
- Không có mô hình dự đoán hiệu quả sinh học, theo đúng yêu cầu.
