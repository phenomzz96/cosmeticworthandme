# 0.5.1 — 3D Model Overhaul (stylized-realistic)

Nền: 0.5 đã duyệt. Phiên bản này **chỉ** đổi mô hình 3D và phần hiển thị/tương tác trực tiếp của nó.
- **Không đổi:** Quiz, Routine Engine, quy tắc, Manager/quản lý phiên bản, Storage, Timeline (logic + UX), Journal, Smart Warning UX, `main.js`, CSS. Băm SHA-256 được ghim trong `tests/v051.test.mjs`.
- **index.html:** chỉ đổi nhãn phiên bản ở tiêu đề/chân trang.
- Không backend, không API AI, không theo dõi người dùng. Không triển khai lên Netlify.

Ảnh bằng chứng nằm trong `docs/screenshots/0.5.1/`. Mọi ảnh mô hình đều render bằng **chính `Viewer3D` của dự án** (Three.js r160 + WebGL trong Chromium), không dùng phần mềm dựng hình khác.

## Làm theo checkpoint

| CP | Nội dung | Bằng chứng |
|---|---|---|
| 1 | Đánh giá `head.glb` 0.5 → **giữ lưới MakeHuman và chỉnh mạnh** (hướng A) | nhật ký quyết định |
| 2 | Hình dáng mặt + tóc; chỉnh theo phản hồi: chân tóc mềm, lọn biến thiên, mép quanh tai, mắt bớt "ngạc nhiên" | `cp2-so-sanh.jpg`, `cp3-so-sanh.jpg` |
| 3 | Mắt, mi, môi, da, tóc, ánh sáng studio | `cp3-so-sanh.jpg`, `cp3-chi-tiet.jpg` |
| Polish | Ánh nhìn dịu, mi/lông mày mềm, chân tóc mềm hơn ở trán và thái dương | `polish-so-sanh.jpg` |
| 4 | Tối ưu GLB, vùng da, camera, 2D, kiểm thử | `toi-uu-truoc-sau.jpg`, `so-sanh-0.5-vs-0.5.1.jpg` |

## Vì sao giữ (không thay) mô hình

**Phương án đã chọn:** giữ lưới gốc MakeHuman hm08 (CC0) và chỉnh hình dáng bằng chính các morph target của MakeHuman (CC0).
- Pipeline cũ tái lập đúng từng byte mô hình 0.5, nên chỉnh ở nguồn là kiểm soát được.
- Mốc giải phẫu, vùng da và sơ đồ 2D vẫn tính từ cùng một lưới.

**Các phương án thay thế bị loại:**
- Đầu Lee Perry-Smith (CC BY): bản quét nam của người thật, không có tóc, sai phong cách.
- `facecap.glb`: không có giấy phép.
- Đầu "Walt": vướng sở hữu trí tuệ.
- Tóc/mi của MakeHuman: không có trên kho GitHub công khai.

Chi tiết: `assets/head.LICENSE.md`.

## Kiểu tóc

Tóc **vén gọn ra sau, búi thấp sau gáy**, phù hợp demo skincare:
- Trán, thái dương, má, cằm, tai để trống.
- Đường chân tóc giữa trán ở y ≈ 0,60, cao hơn hẳn vùng "Trán" (0,28–0,52).

Tóc, lông mày và lông mi do dự án tự dựng (`tools/build-hair.mjs`), không dùng tài nguyên ngoài:
- **Lọn tóc:** 108 lọn chính bám sọ, 34 lọn lớp trên lệch hướng, búi 14 lọn xoắn. Độ rộng và độ sâu rãnh khác nhau theo lọn; màu đỉnh có vệt thớ mảnh. Mỗi lọn có thêm "váy" sát da ở hai mép, nên nhìn sượt ở đỉnh đầu không thấy khe nền sáng lọt qua giữa các lọn.
- **Lớp tóc tơ chân tóc:** bán trong suốt theo đỉnh, nên mép tóc mờ dần, không cắt cứng như mũ hay tóc giả.
- **Lông mày:** 420 nét mỗi bên, mờ dần ở mép và hai đầu.
- **Lông mi:** dựng trên khung bờ mi của MakeHuman. Mi trên mọc theo chùm nhỏ, dài và ngắn xen kẽ; mi dưới thưa và nhạt. Có viền chân mi sẫm trên da.

## Vật liệu và ánh sáng

Không dùng texture, toàn bộ tính theo đỉnh hoặc shader.
- **Da:** MeshPhysical, nhám 0,56, phản xạ 0,42, sheen ấm 0,4. Sắc biến thiên nhẹ: má, mũi, vành tai ấm hơn.
- **Da dưới tóc:** tắt sheen để khe giữa các lọn không lóe sáng.
- **Môi:** mặt nạ `_LIP` theo mốc miệng mới, sửa lệch màu môi của 0.5. Môi trên mỏng hơn môi dưới, cung Cupid nhẹ. Thêm khoang miệng tối, không còn nhìn xuyên khe môi.
- **Mắt:** shader mống mắt theo điểm ảnh, gồm thớ tỏa tia, vòng collarette, viền limbal mềm, đồng tử nâu đen mép mềm. Thêm clearcoat tạo đốm phản chiếu và bóng mí trên. Mống mắt khoảng 12 mm (trước khoảng 15 mm). Lòng trắng ngà, tối dần về khóe.
- **Tóc:** nâu sẫm, nhám 0,66, phản xạ 0,12, sheen nâu, nên không bóng gel, không lộ lọn nhân tạo. Đã thử phản xạ dị hướng: render không khác biệt, nên bỏ để lưới nhẹ hơn.
- **Lông mày và mi:** vật liệu Lambert (không phản xạ gương), bán trong suốt ở ngọn sợi.
- **Ánh sáng studio:**

  | Đèn | 0.5 | 0.5.1 |
  |---|---|---|
  | Đèn chính | 3,4 | 3,0 |
  | Đèn phụ | 0,32 | 0,55 |
  | Nền (hemisphere) | 0,34 | 0,42 |
  | Viền (ấm nhẹ) | 1,2 | 1,4 |

  Không bóng đổ, không hậu xử lý.

## Vùng da, camera, 2D

**Vùng da theo mốc mới** (`ZONE_SHAPES`):

| Vùng | Tâm (x, y) |
|---|---|
| Trán | (0, 0,40) |
| Má | (±0,35, −0,33) |
| Cằm | (0, −0,87) |

Kiểm chứng tự động:
- Không vùng nào nằm dưới tóc hay viền mi, không lấn môi, không chồng nhau.
- Tâm mỗi vùng chọn đúng vùng đó.
- Nhấp lên tóc không chọn vùng nào.

**Camera:** tâm nhìn (0, −0,28, 0,35), bán kính khung 1,38. Mô hình mới nhô ra trước khoảng 0,25 và có tóc. Kiểm tra trên điện thoại dọc: đỉnh tóc và cằm đều nằm trong khung.

**2D dự phòng** sinh lại từ chính mô hình:
- Có lớp tóc (z-buffer phía trước + mặt nạ `_HAIR`).
- Vùng 2D dùng cùng elip với 3D.
- Tóc vẽ dưới vùng chọn, nên không chặn nhấp.

## Tối ưu GLB

So sánh ảnh render trước và sau tối ưu: khác dưới 0,02 % điểm ảnh, mắt thường không phân biệt được (`toi-uu-truoc-sau.jpg`).

| | 0.5 | 0.5.1 trước tối ưu | **0.5.1 bản giao** |
|---|---|---|---|
| `assets/head.glb` | 814 KB | 4,36 MB | **1,53 MB (1,46 MiB)** |
| Tam giác | 40 016 | 124 370 | 124 370 |
| Lệnh vẽ / texture | 3 / 0 | 7 / 0 | 7 / 0 |

`tools/optimize-glb.mjs` chỉ xử lý tóc, lớp tóc tơ và lông mày + mi:
1. Lượng tử hóa (`KHR_mesh_quantization`), bỏ tiếp tuyến không dùng.
2. Sắp lại cho cache GPU.
3. Nén meshopt (`EXT_meshopt_compression`). Trình duyệt giải nén bằng `MeshoptDecoder` đi kèm Three.js 0.160.0, cùng CDN.

Da, mắt và nắp giữ float vì mã chương trình đọc trực tiếp (vùng da, raycast, 2D).

Dựng lại toàn bộ bằng một lệnh, tất định: `node tools/build-model.mjs <makehuman/data>`.

## Hiệu năng

- Render theo nhu cầu: đứng yên thì không vẽ.
- Draw call tăng từ 3 lên 7; tam giác tăng từ 40k lên 124k. Đây là mức nhẹ với GPU thật.
- **Quán tính xoay theo thời gian thật** (không theo số khung): máy chậm không còn "trôi" lâu sau khi thả chuột; tổng góc xoay không đổi.
- **Chế độ nhẹ:** khi PerfMeter báo máy chậm, mật độ điểm ảnh tự về 1 trước khi gợi ý chuyển 2D.
- Trên **renderer phần mềm** (SwiftShader, không có GPU) đo được khoảng 0,2–0,4 giây/khung, so với khoảng 0,1 giây/khung ở 0.5. Trên thiết bị chậm như vậy, cơ chế của 0.5 vẫn đề xuất chuyển 2D.
- Chưa đo được trên GPU thật trong môi trường kiểm thử; xem mục Giới hạn.

## Kiểm thử

- **Node:** `npm test` gồm 181 bài; mới có `tests/v051.test.mjs` (17 bài).
- **Trình duyệt:** 403 bài trên 8 bộ; mới có `tests/ui051.e2e.py` (29 bài). `ui051` cũng đạt khi chạy qua server mô phỏng Live Server.
- **Sửa có chủ đích ở bộ cũ** (mỗi chỗ có chú thích lý do trong mã):
  - `v041` A1/A2/C2: thêm 3 lưới, trần 1,5 MiB / 130k tam giác, da Physical.
  - `v04` 1a′/1b′: bỏ qua lưới nén; tỉ lệ sâu/cao ≤ 1,06; đối xứng có dung sai 0,03 mm.
  - `v042`/`v043`/`v05` 0: bỏ ghim `viewer2d.js` (đã sinh lại).
  - `v05` 1a/1b/1c/3a: hình học mới, trần dung lượng, vị trí vùng, vật liệu.
  - `ui05`: 6 lưới/7 lệnh vẽ; GLB ≤ 1,5 MiB; chờ vòng render dừng sau "Đặt lại góc nhìn" (renderer phần mềm chậm).

## Giới hạn còn lại

- Tóc là các dải lọn bám sọ, chưa có sợi rời; ở góc 45° vẫn hơi tròn đều như một khối. Chỗ lọn bắt đầu nổi lên tạo một gờ mảnh khi nhìn rất gần.
- Mép môi trên hơi răng cưa khi phóng rất gần (theo độ phân giải lưới da). Khóe miệng phải còn một vệt sáng nhỏ ở cận cảnh.
- Mống mắt vẽ trên mặt cầu, chưa có giác mạc khúc xạ.
- Mới kiểm thử trên Chromium với WebGL phần mềm. Chưa thử GPU thật, Safari/iOS, Firefox, Live Server thật và Netlify.
- Trước khi chuyển quán tính sang theo thời gian, hai bài phụ thuộc thời gian (`ui04` Test 2/kéo xoay, `ui05` đặt lại góc nhìn) đôi khi fail trên renderer phần mềm. Sau thay đổi, cả hai lần chạy toàn bộ cuối đều đạt.
