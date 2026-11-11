# Nguồn và giấy phép: `assets/head.glb`

| Mục | Giá trị |
|---|---|
| Mô hình gốc | MakeHuman base mesh `makehuman/data/3dobjs/base.obj` (lưới cơ sở “hm08”) |
| Kho mã | https://github.com/makehumancommunity/makehuman |
| Commit đã dùng | `a8bc2d54ff0ac92e78ff71431b1023eda42bf482` (2024-06-26) |
| SHA-256 của `base.obj` | `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c` |
| Giấy phép | **CC0 1.0 Universal** (dành cho phạm vi công cộng) |
| Chủ sở hữu tại thời điểm phát hành CC0 (09/2020) | Data Collection AB, Joel Palmius, Jonas Hauquier |

## Căn cứ giấy phép

- Phần đầu tệp `base.obj` ghi: tài sản này được phát hành **CC0 vào tháng 9/2020**; văn bản CC0 nằm ở thư mục gốc của kho.
- `LICENSE.md` của kho, mục C “The license for the bundled assets”: *base mesh and proxies, targets, textures…* được phát hành theo **CC0 1.0 Universal**.
- Mục D của `LICENSE.md`: MakeHuman không đòi quyền với dữ liệu xuất ra (OBJ, ảnh render, dữ liệu sinh bằng script).
- Bản sao văn bản CC0 của kho: `assets/CC0-1.0-MakeHuman-LICENSE.ASSETS.md`.

CC0 không bắt buộc ghi công; dự án vẫn ghi nguồn (ở đây, ở chân trang và trong trường `asset.copyright` của tệp GLB) để minh bạch.
CC0 không cấp quyền nhãn hiệu: dự án không dùng tên/logo MakeHuman như thương hiệu.

## Đã chỉnh sửa gì (tools/build-head.mjs)

1. Chỉ lấy các mặt tứ giác của thân (bỏ lưới phụ: tóc, răng, lưỡi, mắt, quần áo trợ giúp); vị trí lưới phụ mắt chỉ dùng để đặt nhãn cầu.
2. Một lần chia Catmull-Clark cho vùng trên ngực (làm mượt đường bao hộp sọ, không thêm biến dạng).
3. Cắt tượng bán thân bằng mặt cong y = 4.85 + 0.2·x² (cắt chính xác từng tam giác, chia sẻ đỉnh cắt) rồi đóng đáy bằng một nắp phẳng.
4. Thêm hai nhãn cầu dạng cầu (32×24) tại tâm lưới mắt gốc; không có mống mắt/đồng tử (phong cách tượng).
5. Chuẩn hóa: đỉnh đầu y = 1, cằm y ≈ −0.82, mắt ở giữa chiều cao đầu, mặt nhìn về +z, má trái của người ở +x.
6. Tính lại pháp tuyến (trung bình theo diện tích), ghi GLB 2.0 (uint16 index, 3 mesh `skin`/`eyes`/`cap`) và các mốc giải phẫu
   (`extras.landmarks`) dùng cho vùng da và sơ đồ 2D.
7. (0.5, `tools/bake-ao.mjs`) Bake **che khuất môi trường theo đỉnh** (thuộc tính `_AO` cho `skin` và `eyes`; 64 tia/đỉnh,
   bán kính 0.32, tất định). **Không đổi hình học**: vị trí, pháp tuyến, chỉ số tam giác, mốc giải phẫu và trường bản quyền giữ nguyên
   (kiểm chứng bằng băm trong `tests/v05.test.mjs`). Đây chỉ là dữ liệu tô bóng do dự án tự tính, không dùng tài nguyên bên ngoài.

## 0.5.1 – nâng cấp mô hình (stylized-realistic)

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Hình dáng khuôn mặt/đầu/cổ | Morph target chính thức của MakeHuman (`makehuman/data/targets`, cùng commit ở trên), áp bằng `tools/apply-targets.mjs` theo công thức `tools/head-recipe.json` | **CC0 1.0** – mỗi tệp `.target` ghi “released as CC0 in september 2020”; `apply-targets.mjs` **từ chối** target không có ghi chú CC0 |
| Vị trí bờ mi (khung đặt lông mi) | Lưới phụ `helper-*-eyelashes` của chính `base.obj` (đã biến dạng theo target) | CC0 1.0 (như trên); chỉ dùng tọa độ, không đóng gói lưới phụ |
| Tóc (vén gọn + búi thấp), lớp tóc tơ chân tóc, lông mày, lông mi, khoang miệng, mặt nạ `_HAIR`/`_LIP` | Dự án tự dựng bằng thuật toán trong `tools/build-hair.mjs` (không dùng tài nguyên ngoài) | Thuộc dự án |
| Nén lưới (`EXT_meshopt_compression`) | Bộ mã hóa meshoptimizer (zeux/meshoptimizer, commit `f0a684f`, `js/meshopt_encoder.js`) – chỉ chạy khi dựng, lưu ở `tools/vendor/` | **MIT** – văn bản ở `tools/vendor/meshoptimizer-LICENSE.md` |
| Giải nén trong trình duyệt | `MeshoptDecoder` đi kèm Three.js 0.160.0 (`three/addons/libs/meshopt_decoder.module.js`, cùng CDN với Three.js) | MIT (Three.js / meshoptimizer) |

Các bước 0.5.1 (đều tất định – chạy lại cho ra cùng tệp):
1. `tools/apply-targets.mjs`: áp các target CC0 (macro nữ trẻ, tỉ lệ lý tưởng; mắt, mũi, môi, cằm, gò má, trán, tai, cổ) lên `base.obj`.
2. `tools/build-head.mjs`: như trên; chuẩn hóa theo đỉnh mốc (#881 đỉnh đầu, #991 cằm, #509 khe môi) để khuôn mặt luôn đúng khung.
3. `tools/build-hair.mjs`: 108 lọn tóc bám sọ + lớp lọn trên + búi 14 lọn; lớp tóc tơ bán trong suốt ở chân tóc; lông mày dạng nét sợi;
   lông mi trên/dưới dựng trên khung bờ mi; khối tối khoang miệng; mặt nạ da đầu/viền mi/nền mày (`_HAIR`) và môi (`_LIP`).
4. `tools/bake-ao.mjs`: như 0.5 (tóc cũng tính là vật che).
5. `tools/optimize-glb.mjs`: lượng tử hóa (`KHR_mesh_quantization`) + nén meshopt cho `hair`, `hairline`, `brows`;
   `skin`/`eyes`/`cap` giữ float (mã chương trình đọc trực tiếp). Ảnh render trước/sau nén khác nhau < 0,02 % điểm ảnh.
6. `tools/gen-face2d.mjs --write`: sinh lại sơ đồ 2D (có tóc) từ chính mô hình.

Một lệnh cho tất cả: `node tools/build-model.mjs <đường-dẫn>/makehuman/data`
(cần `git sparse-checkout set makehuman/data/3dobjs makehuman/data/targets` trong kho MakeHuman).

Tệp `base.obj` (≈ 1,7 MB) **không** được đóng gói; chỉ cần khi muốn dựng lại:
`git clone --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman && cd makehuman && git sparse-checkout set makehuman/data/3dobjs`
rồi `node tools/build-head.mjs <đường-dẫn>/makehuman/data/3dobjs/base.obj assets/head.glb`, `node tools/bake-ao.mjs` (0.5) và `npm run gen:face2d -- --write`.
