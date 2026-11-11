# Log kiểm thử 0.4.1

- `orig85-on-041.txt`: 85 bài JavaScript **gốc của 0.4**, chạy nguyên văn trên mã 0.4.1 (sau khi gỡ `js/face3d.js`).
- `orig-v04-with-face3d.txt`: bộ `v04` gốc chạy khi `face3d.js` còn trong thư mục (19/20; bài 2e lỗi vì 2D đã sinh từ GLB).
- `final-*.txt`: kết quả cuối, chạy trên **bản ZIP đã giải nén ra thư mục mới**:
  - `final-node.txt`: `npm test`, 103/103.
  - `final-ui.txt` 17/17, `final-ui031.txt` 43/43, `final-ui04.txt` 72/72, `final-ui041.txt` 63/63.
  - `*-live.txt`: chạy qua `tests/serve_like_live_server.py` (mô phỏng Live Server chèn script tự tải lại).

Môi trường: Node 22, Chromium headless (Playwright), WebGL bằng SwiftShader (CPU). Three.js r160 được phục vụ cục bộ bằng
`--three-dir`, vì môi trường chặn jsDelivr. Các bộ e2e chạy với `TZ=UTC`.
