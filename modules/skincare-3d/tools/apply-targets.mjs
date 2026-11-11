// Áp các morph target MakeHuman (CC0) lên base.obj → base đã biến dạng (cùng số đỉnh, cùng thứ tự, cùng mặt).
//   node tools/apply-targets.mjs <base.obj> <thư-mục-targets> <công-thức.json> <ra.obj>
// Công thức: {"targets":[["macrodetails/caucasian-female-young.target",0.33], ...]} – đường dẫn tương đối với <thư-mục-targets>.
// Tệp .target: mỗi dòng "chỉ-số-đỉnh dx dy dz" (đơn vị gốc của MakeHuman). Không tải gì từ mạng; tất định.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [SRC,TDIR,RECIPE,OUT]=process.argv.slice(2);
if(!OUT){console.error('Dùng: node tools/apply-targets.mjs <base.obj> <targets-dir> <recipe.json> <out.obj>');process.exit(1)}
const lines=readFileSync(SRC,'utf8').split('\n'),vi=[];lines.forEach((l,k)=>{if(l.startsWith('v '))vi.push(k)});
const V=vi.map(k=>lines[k].split(/\s+/).slice(1,4).map(Number)),D=V.map(()=>[0,0,0]);
const recipe=JSON.parse(readFileSync(RECIPE,'utf8'));let used=0;
for(const [rel,w] of recipe.targets){
 if(!w)continue;const txt=readFileSync(join(TDIR,rel),'utf8');
 if(!/CC0/.test(txt.slice(0,600)))throw new Error(`${rel}: không thấy ghi chú CC0 ở đầu tệp – dừng để tránh dùng tài nguyên không rõ giấy phép`);
 for(const l of txt.split('\n')){if(!l||l[0]==='#')continue;const [i,x,y,z]=l.trim().split(/\s+/).map(Number);if(!(i>=0&&i<V.length))continue;D[i][0]+=w*x;D[i][1]+=w*y;D[i][2]+=w*z}
 used++;
}
vi.forEach((k,i)=>{const p=V[i].map((v,c)=>v+D[i][c]);lines[k]=`v ${p.map(v=>+v.toFixed(6)).join(' ')}`});
writeFileSync(OUT,lines.join('\n'));
console.error(`Đã áp ${used} target lên ${V.length} đỉnh → ${OUT}`);
