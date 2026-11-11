// 0.5.1 – dựng lại TOÀN BỘ mô hình 3D + sơ đồ 2D bằng một lệnh (tất định: chạy lại cho ra cùng tệp).
//   node tools/build-model.mjs <thư-mục makehuman/data>
// Cần bản sao kho MakeHuman (CC0) có data/3dobjs/base.obj và data/targets (macrodetails, head, nose, chin, cheek, eyes, mouth,
// forehead, neck, ears, eyebrows):
//   git clone --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman
//   cd makehuman && git sparse-checkout set makehuman/data/3dobjs makehuman/data/targets
// Các bước:
//   1. apply-targets.mjs  base.obj + tools/head-recipe.json → OBJ đã chỉnh hình dáng (chỉ nhận target ghi CC0)
//   2. build-head.mjs     → da, nhãn cầu, nắp đáy, mốc giải phẫu (+ khung mi tạm)
//   3. build-hair.mjs     → tóc vén gọn + búi thấp, lớp tóc tơ chân tóc, lông mày, lông mi, khoang miệng; mặt nạ _HAIR/_LIP
//   4. bake-ao.mjs        → che khuất môi trường theo đỉnh (_AO) cho da và mắt
//   5. optimize-glb.mjs   → lượng tử hóa + nén meshopt cho tóc/lông mày/mi → assets/head.glb
//   6. gen-face2d.mjs     → js/viewer2d.js (sơ đồ 2D sinh từ chính mô hình)
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const data=process.argv[2];if(!data){console.error('Cách dùng: node tools/build-model.mjs <thư-mục makehuman/data>');process.exit(2)}
const T=new URL('.',import.meta.url).pathname,root=new URL('..',import.meta.url).pathname,tmp=mkdtempSync(join(tmpdir(),'head-'));
const run=(script,...args)=>{const r=spawnSync(process.execPath,[join(T,script),...args],{cwd:root,stdio:'inherit'});if(r.status!==0){rmSync(tmp,{recursive:true,force:true});process.exit(r.status||1)}};
run('apply-targets.mjs',join(data,'3dobjs/base.obj'),join(data,'targets'),join(T,'head-recipe.json'),join(tmp,'head.obj'));
run('build-head.mjs',join(tmp,'head.obj'),join(tmp,'raw.glb'));
run('build-hair.mjs',join(tmp,'raw.glb'),join(tmp,'hair.glb'));
run('bake-ao.mjs',join(tmp,'hair.glb'),join(tmp,'ao.glb'));
run('optimize-glb.mjs',join(tmp,'ao.glb'),join(root,'assets/head.glb'));
run('gen-face2d.mjs','--write');
rmSync(tmp,{recursive:true,force:true});
console.log('Xong: assets/head.glb và js/viewer2d.js');
