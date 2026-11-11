# Skincare Prototype 0.4: Mô hình 3D nâng cấp và thiết kế lại giao diện

Nền tảng là bản 0.3.1 trong Project (đã đối chiếu: giống hệt bản bàn giao 0.3.1). Kiến trúc HTML/CSS/JS ES modules giữ nguyên. **Không đổi:** `engine.js`, `rules.js`, `storage.js`, `timeline.js`, `manager.js`, `data.js`.

## 1. Kiến trúc 3D cũ và hạn chế (0.3.1)
`viewer3d.js` (49 dòng) dựng đầu bằng một `SphereGeometry` kéo dãn, mắt là 2 quả cầu đen, mũi là `ConeGeometry`, miệng là `BoxGeometry`; 4 vùng da là 4 hình cầu bán trong suốt đặt trước mặt. Tôi đã chạy bản này với Three.js thật để đối chiếu và thấy các hạn chế:
- **Hình dạng:** không có hàm, cằm hay đường nét; nhìn nghiêng là một quả trứng.
- **Vùng da:** khối xám **lơ lửng**, che khuôn mặt, chọn vùng bằng cách bắn tia vào các khối này.
- **Vòng render:** chạy liên tục (khoảng 60 lần/giây) kể cả khi không có thao tác; không dừng khi tab ẩn.
- **Tài nguyên:** `dispose()` không giải phóng geometry/material, không gọi `forceContextLoss`; bấm "3D" nhiều lần khi đang tải có thể tạo hai renderer.
- **Cử chỉ:** chuột và cảm ứng dùng chung ngưỡng 5px; không phân biệt chụm hai ngón; không có góc nhìn sẵn; zoom không có hiệu ứng.
- **2D:** ellipse đơn giản, khác hẳn mô hình 3D.

## 2. Hướng thiết kế mô hình 3D mới
- **Procedural, tự chứa trong dự án** (`js/face3d.js`, module thuần, test bằng Node). Không dùng GLTF/GLB nên **không có vấn đề giấy phép hay nguồn tải ngoài**, không tăng kích thước tải (chỉ thêm khoảng 20 KB mã).
- **Lưới:** lưới cầu 180×150 ô, dày đặc hơn ở vùng mặt (khoảng 27 nghìn đỉnh, 54 nghìn tam giác). Mỗi đỉnh được "nắn" bằng các hàm toán học:
  - hộp sọ rộng phía trên, hàm thu hẹp, đáy cằm tròn, góc hàm;
  - mặt dưới được đẩy ra trước để nhìn nghiêng không bị lẹm cằm;
  - hốc mắt, mí, gò mày, thái dương, sống mũi, đầu mũi, cánh mũi, gò má, má, môi trên/dưới, khe miệng, cằm.

  Tỷ lệ theo quy tắc ba phần của khuôn mặt. Tai, cổ và vai (tượng bán thân) được dựng riêng.
- **Nét mặt:** mắt **nhắm** (tránh cảm giác "nhìn chằm chằm"), lông mày và đường môi là các dải mỏng nằm sát bề mặt da.
- **Màu:** bóng che khuất giả ở chỗ lõm; màu môi; màu da trung tính, **không bao giờ đổi theo routine hay thời gian**.
- **Vùng da:** trọng số mềm tính cho từng đỉnh. Vùng được chọn được tô màu ngay trên bề mặt (vertex color, chuyển mượt), có **viền liền là dải khép kín trên da**. Vùng khác giảm nhấn mạnh; "toàn mặt" phủ nhẹ toàn khuôn mặt cộng cả 4 vùng.
- **Chọn vùng:** raycast vào một lưới ẩn độ phân giải thấp (khoảng 4,3 nghìn đỉnh, cùng hàm hình dạng) → tam giác trúng → trọng số vùng. Trúng mũi, mắt hoặc tai thì không chọn vùng nào.
- **Ánh sáng:** đèn bán cầu dịu, đèn chính mềm và đèn phụ đi theo camera, đèn viền phía sau; vật liệu `MeshPhysicalMaterial` có sheen nhẹ; tone mapping ACES. Không có bóng đổ hay hậu xử lý.
- **Giới hạn trung thực:** đây là mô hình **stylized kiểu ma-nơ-canh mỹ phẩm**, không phải mô hình chân thực hay quét 3D. Không có tóc, kết cấu da hay biểu cảm. Một số chi tiết (tai, vai) vẫn là khối đơn giản.

## 3. UI/UX
- **Trang chủ** dạng cửa hàng mẫu:
  - hero kèm nút vào tính năng, thẻ tài khoản giả lập;
  - lưới sản phẩm có hình minh họa SVG theo nhóm (không phải ảnh thật), nhãn "Đã mua", thời điểm dùng;
  - **không** có giỏ hàng hay thanh toán.
- **Luồng tính năng:** thanh tiến trình 6 giai đoạn (dấu ✓ khi giai đoạn đã có dữ liệu, tô đậm phần đang xem theo vị trí cuộn, bấm để nhảy tới).
- **Quiz:** lựa chọn dạng chip.
- **Routine:** thẻ trạng thái có icon và tiêu đề; mục tiêu ✓/✗ kèm chữ; **cảnh báo luôn có icon cộng nhãn chữ** (Cần thận trọng / Xung đột / Trùng–chồng chéo / Thiếu bước / Thiếu dữ liệu / Tham khảo); hai cột Sáng/Tối với **thẻ bước** gồm:
  - số thứ tự, tên bước, sản phẩm, cách dùng;
  - mục đích, thời điểm, vùng áp dụng, cảnh báo;
  - trạng thái chọn, nút "Xem trên mô hình".
- **Studio mô hình:**
  - desktop chia 2 cột: mô hình bên trái, thông tin bên phải;
  - thanh công cụ: 3D/2D, Chính diện / Má trái / Má phải, +/−, Đặt lại;
  - thanh chọn vùng (cho bàn phím và màn hình cảm ứng), gợi ý thao tác;
  - bộ chọn bước nhanh; bảng thông tin không che mô hình.
- **Timeline:** khối Ngày 0 tách riêng, trục 4 mốc, các ô trạng thái dạng lưới, lịch sử áp dụng dạng dòng thời gian (có ghi chú "đã sửa ngày"). Logic dữ liệu giữ nguyên 0.3.1.
- **Nhật ký:** thang trượt có giá trị hiển thị và chú thích hai đầu; biểu đồ lớn hơn, có nhãn trục, không nội suy.
- **Responsive:** 1440 / 1024 / 768 / 390 px.
  - Trên điện thoại, header không bám đầu trang; chỉ thanh tiến trình gọn bám ở trên.
  - Mô hình tự co theo màn hình; canvas chặn cuộn trang khi đang xoay (`touch-action:none`) nhưng chỉ cao tối đa 420px để vẫn còn chỗ cuộn.

## 4. File thay đổi
| File | Thay đổi |
|---|---|
| `js/viewer3d.js` | **Viết lại phần ruột** (giao diện cũ giữ nguyên + `view`, `invalidate`, `projectZone`, `debugInfo`) |
| `js/viewer2d.js` | SVG mới **sinh tự động** từ hình học 3D; hover, bàn phím, phủ toàn mặt |
| `js/face3d.js` | **Mới:** hình học, vùng da, highlight, dải nét mặt, cổ–vai |
| `js/view3d-math.js` | **Mới:** camera, tween, phân biệt cử chỉ, đo hiệu năng |
| `js/selection.js` | **Mới:** đồng bộ bước ↔ vùng |
| `js/icons.js` | **Mới:** icon và hình minh họa SVG hằng số |
| `js/main.js` | Các hàm render cho giao diện mới; studio; đồng bộ; chế độ hiệu năng; xử lý lỗi 3D giữ lựa chọn. Logic Manager/Storage/Ngày 0/nhật ký giữ nguyên |
| `js/journal.js` | Biểu đồ: chữ lớn hơn, có nhãn trục (logic không đổi) |
| `index.html`, `css/style.css` | Cấu trúc và giao diện mới (Three.js vẫn 0.160.0 từ jsDelivr) |
| `tools/gen-face2d.mjs` | **Mới:** sinh lại `viewer2d.js` (`npm run gen:face2d -- --write`) |
| `tests/v04.test.mjs`, `tests/ui04.e2e.py`, `tests/fixtures/data-0.3.1.json` | **Mới** |
| `tests/v031.test.mjs`, `tests/ui031.e2e.py` | Điều chỉnh 2 chỗ (mục 6) |
| `package.json`, `README.md` | `version 0.4.0`, lệnh test; tài liệu |

## 5. Bài kiểm thử bổ sung
**`tests/v04.test.mjs`** (20 test Node):
- hình học hợp lệ, đối xứng, tỷ lệ;
- thứ tự các nét mặt; mũi nhô xa nhất; hốc mắt lõm;
- dải nét mặt và viền vùng nằm trên bề mặt;
- quy ước má trái = +x;
- các vùng không chồng nhau, nằm trong phạm vi "toàn mặt";
- chọn vùng theo ngưỡng;
- highlight chỉ đổi màu vùng được chọn;
- **tâm vùng 2D lệch ≤ 4px so với phép chiếu 3D**;
- camera vừa khung, giới hạn, tween, giảm chuyển động;
- phân biệt nhấp / kéo / chạm / vuốt / giữ lâu / chụm;
- đo hiệu năng không kết luận từ một đợt;
- đồng bộ bước ↔ vùng (toàn mặt, vùng riêng, thay sản phẩm, xóa bước đang chọn, bước không có dữ liệu vùng);
- icon an toàn;
- viewer3d giải phóng đủ tài nguyên;
- Three.js chỉ import động và vẫn là bản 0.160.0.

**`tests/ui04.e2e.py`** (72 kiểm tra, **3D thật**) theo đủ 10 kịch bản:
- xoay vs chọn bằng chuột, đo màu pixel để xác nhận vùng được tô và vùng khác không đổi;
- chạm / vuốt / chụm trên màn hình cảm ứng (CDP);
- chọn bước → vùng; thay và xóa sản phẩm;
- 3D↔2D ×8 (1 canvas, 1 lần khởi tạo, tài nguyên không đổi, heap tăng < 4 MB sau GC);
- ẩn/hiện tab, chuyển trang, đổi kích thước;
- giới hạn zoom, nút góc nhìn, giảm chuyển động;
- lỗi giả lập khi chạy và khi khởi tạo, khởi tạo lại ×3;
- không có WebGL; không tải được Three.js;
- 4 cỡ màn hình;
- dữ liệu 0.3.1 thật;
- XSS trên giao diện mới.

## 6. Test cũ được điều chỉnh (có lý do)
| Test | Lý do |
|---|---|
| `v031.test.mjs` › 6b | `viewer2d.js` giờ là hằng SVG. Kiểm tra cũ tìm `innerHTML=` theo sau là một template literal (``innerHTML=`…` ``), không còn khớp. Nay kiểm tra **cả file** không có chèn giá trị `${…}`, **chặt hơn trước** |
| `v031.test.mjs` › danh sách file quét tĩnh | Thêm 4 module mới vào phạm vi quét (mở rộng, không nới lỏng) |
| `ui031.e2e.py` › `BAD_NODES` | Giao diện mới dùng icon SVG hằng số (`.ic`, `.art`). Selector cũ coi **mọi** `<svg>` trong routine là dấu hiệu bị chèn mã. Nay bỏ qua các lớp icon hằng số. Kiểm tra `on*` và `window.__xss` giữ nguyên |

Không test nào bị xóa hay vô hiệu hóa.

## 7. Kết quả kiểm thử (đã chạy thật)
| Bộ test | Kết quả |
|---|---|
| `npm test` (18 + 18 + 29 + 20), dưới 4 múi giờ: UTC, Asia/Ho_Chi_Minh, America/New_York, Pacific/Chatham | **85/85 đạt** |
| `ui.e2e.py` (0.3, không sửa) | **17/17** |
| `ui031.e2e.py` | **43/43** (44/44 với `--live`) |
| `ui04.e2e.py` (3D thật) | **72/72** |
| Cả ba bộ e2e qua server mô phỏng Live Server (có script inline chèn vào), ở thư mục gốc và thư mục con | đều đạt |

**Môi trường kiểm thử:** Chromium headless. WebGL do **SwiftShader (render bằng CPU)** cung cấp. Three.js lấy từ tag `r160` trên GitHub qua git và trỏ yêu cầu CDN về bản này, vì jsDelivr bị chặn trong môi trường kiểm thử. Ứng dụng vẫn dùng jsDelivr.

**Số đo hiệu năng** (ở 1440px, pixel ratio 1):
- 13 đối tượng, 17 draw call, khoảng 60,5 nghìn tam giác, 0 texture, 13 geometry / 10 material được quản lý;
- khởi tạo khoảng 1,5 giây, gồm tải Three.js cục bộ và dựng lưới;
- FPS khi xoay liên tục khoảng **4** trên SwiftShader. Con số này **không đại diện** cho thiết bị có GPU, và tôi **chưa đo FPS trên thiết bị thật**.

**Chưa kiểm chứng:**
- VS Code + Live Server thật;
- Netlify;
- Firefox, Safari, điện thoại và máy tính bảng thật (đã giả lập viewport và cảm ứng trên Chromium);
- FPS trên GPU thật;
- trình đọc màn hình.

## 8. Chạy bằng VS Code + Live Server
1. Giải nén ZIP, mở thư mục `skincare-prototype` trong VS Code.
2. Chuột phải `index.html` → *Open with Live Server*, rồi nhấn **Ctrl+F5** nếu trước đó đã mở bản cũ.
3. Mở F12 → Console: không có lỗi đỏ (dòng "Live reload enabled." là của Live Server).

**Danh sách kiểm tra thủ công (cần bạn xác nhận):**

| # | Thao tác | Mong đợi |
|---|---|---|
| 1 | Trang chủ ở cửa sổ rộng và hẹp | Lưới sản phẩm gọn, không thanh cuộn ngang |
| 2 | "Kiến trúc sư…", làm quiz | Mô hình 3D hiện, không trắng màn hình |
| 3 | Kéo chuột trên mô hình | Mô hình xoay mượt, **không** tự chọn vùng |
| 4 | Nhấp vào trán | Viền đậm, vùng tô xanh nhạt, bảng phải hiện "Trán" và các bước liên quan |
| 5 | Bấm một thẻ bước | Thẻ sáng lên, mô hình tô đúng vùng, bảng hiện sản phẩm và lưu ý |
| 6 | Thay hoặc bỏ sản phẩm của bước đang chọn | Mô hình và bảng cập nhật; nếu bước biến mất thì có thông báo |
| 7 | Chính diện / Má trái / Má phải / +/− / Đặt lại | Camera chuyển mượt (hoặc chuyển ngay nếu máy bật giảm chuyển động) |
| 8 | 3D ↔ 2D nhiều lần | Lựa chọn giữ nguyên, không chậm dần |
| 9 | "Giả lập lỗi 3D (dev)" | Có thông báo, chuyển 2D, mọi thứ khác vẫn chạy; tắt giả lập rồi bấm 3D thì chạy lại |
| 10 | Điện thoại thật: chạm chọn vùng, vuốt xoay, chụm phóng to | Hoạt động; chụm không chọn nhầm vùng |
| 11 | "Hiệu năng (dev)" khi đang xoay | Hiện FPS ước lượng, draw calls, tam giác. Hãy ghi lại FPS trên máy bạn |
| 12 | Timeline, nhật ký, lưu/khôi phục phiên bản, F5 | Như 0.3.1 |

## 9. Cập nhật website Netlify
Không có bước build.
- **Kéo thả:** Netlify → Sites → chọn site → **Deploys** → kéo thả thư mục `skincare-prototype` đã giải nén vào ô "Drag and drop".
- **Nối Git:** commit toàn bộ thư mục rồi push.

Sau khi deploy, mở trang bằng HTTPS và nhấn Ctrl+F5. Dữ liệu người dùng (localStorage) nằm trên trình duyệt từng người, nên deploy không làm mất dữ liệu. Thư mục `tests/` và `tools/` không ảnh hưởng tới trang, có thể giữ hoặc bỏ.

## 10. Phần chưa hoàn thiện
- Mô hình vẫn là **stylized**: tai và vai đơn giản; không có tóc, biểu cảm hay kết cấu da. Mô hình chi tiết hơn cần mô hình do họa sĩ dựng (GLB có giấy phép rõ ràng) và đánh đổi về kích thước tải.
- Mô hình 2D lấy đường bao từ phép chiếu thẳng nên phần cổ–vai hơi "vuông".
- FPS thật trên điện thoại tầm thấp chưa đo. Nếu chậm, có thể giảm độ phân giải lưới trên màn hình nhỏ (chưa làm, vì chưa có số đo).
- Gợi ý "chuyển 2D khi chậm" chỉ hiện khi có ≥ 3 giây render chậm, rơi vào ≥ 2 đợt tương tác. Ngưỡng 24 FPS là lựa chọn của tôi, chưa được kiểm định.
- Bảng hiệu năng là công cụ developer; FPS chỉ tính khi đang render liên tục.
- Chưa kiểm thử với trình đọc màn hình. Canvas 3D có `aria-label`; thao tác vùng da bằng bàn phím thông qua thanh vùng da và mô hình 2D.
- Các tồn tại từ 0.3.1 vẫn còn: chưa có CSP/SRI, ảnh không mã hóa, nhật ký chưa liên kết phiên bản, bộ quy tắc chưa được chuyên gia duyệt…

## 11. Bảo mật (rà soát tĩnh các file đã sửa và toàn bộ `js/`, `index.html`, `css/`)
| Hạng mục | Kết quả |
|---|---|
| Bí mật, API key, token | Không có |
| Mạng, tracking | Chỉ `cdn.jsdelivr.net` (Three.js 0.160.0, có từ trước); không có fetch, XHR, WebSocket hay analytics. Mô hình 3D dựng tại chỗ, không tải tài nguyên ngoài |
| Mã thực thi động | Không có `eval`, `new Function` hay `document.write` |
| `innerHTML` | Chỉ trong `setHtml()` và hằng SVG `viewer2d.js` (test bảo đảm không có `${}`) |
| XSS trên giao diện mới | Mọi nội dung đi qua `` html`…` ``. Cơ chế kiểm tra ngữ cảnh **đã chặn một lỗi của chính tôi trong quá trình làm** (chèn giá trị vào `href` của thanh tiến trình), và tôi đã sửa sang `data-act`. Test 9 (e2e) và bộ XSS 0.3.1 đều đạt |
| Móc kiểm thử `window.__skc` | Chỉ bật khi URL có `?dev`. Nó cho phép đọc trạng thái giao diện trong chính trình duyệt đó. Không có dữ liệu bí mật nên rủi ro **thấp**; nếu tích hợp thật nên xóa hoặc chỉ bật ở bản dev |
| Rủi ro còn lại | Như 0.3.1: CDN không có SRI/CSP (**trung bình** khi chạy công khai); ảnh nhật ký không mã hóa |

Kết luận chỉ dựa trên đọc mã và kiểm thử tự động, **không** chứng minh an toàn tuyệt đối.

## Tự đánh giá (theo tiêu chí XIII; không chấm điểm tuyệt đối)
| # | Tiêu chí | Bằng chứng / mức tin cậy |
|---|---|---|
| 1 | Hình dạng 3D | Cải thiện rõ (ảnh so sánh trước/sau, test tỷ lệ). Vẫn là stylized |
| 2 | Tương tác chính xác | Raycast trên tam giác thật; test chuột/chạm/vuốt/chụm và màu pixel. Cảm ứng mới kiểm thử trên giả lập |
| 3 | Đồng bộ routine ↔ mô hình | Test Node + e2e cho cả 3 trường hợp và xóa bước đang chọn |
| 4 | Dễ hiểu | Đã xem ảnh chụp, chưa thử với người dùng |
| 5 | Điện thoại | Test 4 viewport, nút ≥ 32px, không cuộn ngang. Chưa thử máy thật |
| 6 | Hiệu năng / bộ nhớ | Tài nguyên ổn định qua nhiều chu kỳ, render theo nhu cầu. FPS trên GPU thật chưa đo |
| 7 | Dự phòng 2D | Đã test: lỗi khi chạy, lỗi khi khởi tạo, không có WebGL, không tải được thư viện |
| 8 | Ổn định chức năng cũ | 65 test Node cũ + 60 e2e cũ đạt |
| 9 | An toàn dữ liệu động | `` html`…` ``, XSS e2e, quét tĩnh |
| 10 | Bảo trì | Logic 3D tách thành module thuần có test; 2D sinh tự động từ 3D |
