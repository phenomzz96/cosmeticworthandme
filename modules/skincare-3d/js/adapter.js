// Host-data adapter (v1.0): maps a host e-commerce site's product/quiz data into the internal
// schema the routine engine (engine.js/rules.js) already expects. Pure functions, no DOM, no
// dependency on how the host site is built — the host can be a static page, WordPress/WooCommerce,
// or anything else that can postMessage a plain object (see docs/integration.md for the wire format).
//
// Design rule: this file NEVER invents ingredients, usage instructions, warnings, or any other
// skincare content. If a field is missing or unrecognised, it is left empty/null and reported in
// `issues` — the existing engine.classify() already excludes incomplete products from the routine
// and tells the user why ("Thiếu dữ liệu…"), so this adapter does not duplicate that validation or
// try to be clever about defaults. It only renames/reshapes fields.
import {RULES} from './rules.js';
import {ZONES} from './data.js';

const CATS=new Set(Object.keys(RULES.categories));           // cleanser,toner,serum,treatment,moisturizer,sunscreen
const ZONE_KEYS=new Set([...Object.keys(ZONES),'face']);      // forehead,cheekL,cheekR,chin,face
const PERIODS=new Set(['am','pm','both']);

// Meta/attribute key names this adapter recognises for the WooCommerce-style shape
// ({id,name,categories:[{slug}],meta_data:[{key,value}],attributes:[{name,options}]}).
// A host using different key names should either rename before sending, or send the "simple" shape
// (a plain object with the field names below) instead — both shapes are accepted per-product.
const META_KEYS={
 category:['skincare_category','category'],
 functions:['skincare_functions','functions'],
 ingredients:['ingredients','skincare_ingredients'],
 actives:['skincare_actives','actives'],
 recommendedPeriod:['skincare_period','recommended_period','recommendedPeriod'],
 zones:['skincare_zones','zones'],
 usageInstructions:['usage_instructions','directions','usageInstructions'],
 warnings:['skincare_warnings','warnings']};

const arr=v=>Array.isArray(v)?v.map(String):(v==null||v===''?[]:String(v).split(',').map(s=>s.trim()).filter(Boolean));
const str=v=>v==null?'':String(v);
function fromMeta(raw,key){
 const names=META_KEYS[key];
 if(Array.isArray(raw?.meta_data))for(const m of raw.meta_data)if(m&&names.includes(m.key))return m.value;
 if(Array.isArray(raw?.attributes))for(const a of raw.attributes)if(a&&(names.includes(a.name)||names.includes(a.key)))return a.options??a.option??a.value;
 return undefined;
}

// Maps ONE product. Accepts either shape (fields are tried in this order, first defined wins):
//  1. "simple": {id,name,category,functions,ingredients,actives,recommendedPeriod,zones,usageInstructions,warnings}
//     — already the internal schema; pass-through with validation only.
//  2. "WooCommerce-style": {id,name,categories:[{slug|name}],short_description,meta_data,attributes}
//     — category/functions/etc. read from meta_data/attributes using META_KEYS above.
// Returns {product, issues}. `product` is null only if there is no usable id — otherwise a product
// is always returned (possibly with category/functions/recommendedPeriod left null/empty), because
// the engine itself decides eligibility; the adapter's job is mapping, not gatekeeping.
export function mapProduct(raw){
 const issues=[];
 if(raw==null||typeof raw!=='object')return {product:null,issues:['dữ liệu sản phẩm không phải object']};
 const id=raw.id!=null?String(raw.id):(raw.sku?String(raw.sku):null);
 if(!id){issues.push('thiếu id/sku — bỏ qua sản phẩm này');return {product:null,issues}}
 const name=str(raw.name??raw.title??id);
 let category=raw.category??fromMeta(raw,'category');
 if(category==null&&Array.isArray(raw.categories)&&raw.categories.length)category=raw.categories[0]?.slug??raw.categories[0]?.name;
 category=category?String(category).toLowerCase().trim():null;
 if(category&&!CATS.has(category)){issues.push(`category "${category}" không nằm trong danh sách hỗ trợ (${[...CATS].join(', ')}) — bỏ qua`);category=null}
 const functions=arr(raw.functions??fromMeta(raw,'functions'));
 let zones=arr(raw.zones??fromMeta(raw,'zones'));
 const badZones=zones.filter(z=>!ZONE_KEYS.has(z));
 if(badZones.length){issues.push(`zone không hợp lệ: ${badZones.join(', ')} (hợp lệ: ${[...ZONE_KEYS].join(', ')})`);zones=zones.filter(z=>ZONE_KEYS.has(z))}
 let recommendedPeriod=raw.recommendedPeriod??fromMeta(raw,'recommendedPeriod');
 recommendedPeriod=recommendedPeriod?String(recommendedPeriod).toLowerCase().trim():null;
 if(recommendedPeriod&&!PERIODS.has(recommendedPeriod)){issues.push(`recommendedPeriod "${recommendedPeriod}" không hợp lệ (cần am/pm/both)`);recommendedPeriod=null}
 const ingredients=arr(raw.ingredients??fromMeta(raw,'ingredients'));
 const actives=arr(raw.actives??fromMeta(raw,'actives'));
 const usageInstructions=str(raw.usageInstructions??fromMeta(raw,'usageInstructions')??raw.short_description??'');
 const warnings=arr(raw.warnings??fromMeta(raw,'warnings'));
 if(!category)issues.push('thiếu category — sản phẩm sẽ bị loại khỏi routine tới khi được bổ sung');
 if(!functions.length)issues.push('thiếu functions — sản phẩm sẽ bị loại khỏi routine tới khi được bổ sung');
 if(!recommendedPeriod)issues.push('thiếu recommendedPeriod — sản phẩm sẽ bị loại khỏi routine tới khi được bổ sung');
 return {product:{id,name,category,functions,ingredients,actives,recommendedPeriod,zones,usageInstructions,warnings},issues};
}

// Maps a whole catalogue array. `report` lists per-product issues (for host-side debugging);
// products with no id are dropped (nothing else is), everything else is kept even if incomplete.
export function mapCatalog(rawList){
 const products=[],report=[];
 for(const raw of (Array.isArray(rawList)?rawList:[])){
  const {product,issues}=mapProduct(raw);
  if(product)products.push(product);
  if(issues.length)report.push({id:product?.id??null,source:raw?.id??raw?.sku??null,issues});
 }
 return {products,report};
}

// Quiz/goals: unknown goal keys or skin type are dropped (not fatal) and reported.
export function mapQuiz(raw){
 const issues=[];
 if(!raw||typeof raw!=='object')return {quiz:null,issues:['thiếu dữ liệu quiz']};
 const goalsIn=arr(raw.goals);
 const goals=goalsIn.filter(g=>RULES.goals[g]);
 const dropped=goalsIn.filter(g=>!RULES.goals[g]);
 if(dropped.length)issues.push(`bỏ qua goal không xác định: ${dropped.join(', ')} (hợp lệ: ${Object.keys(RULES.goals).join(', ')})`);
 let skin=raw.skin??null;
 if(skin&&!RULES.skin[skin]){issues.push(`bỏ qua skin type không xác định: "${skin}"`);skin=null}
 return {quiz:{goals,skin},issues};
}

// Purchased/selected product ids: keep only ids present in the (already-mapped) catalogue, so the
// routine engine never sees a "purchased" id it can't resolve to a product.
export function mapPurchasedIds(rawIds,catalogProducts){
 const known=new Set((catalogProducts||[]).map(p=>p.id));
 const ids=arr(rawIds);
 const kept=ids.filter(id=>known.has(id));
 const dropped=ids.filter(id=>!known.has(id));
 return {ids:kept,issues:dropped.length?[`bỏ qua ${dropped.length} id đã mua không có trong catalogue: ${dropped.join(', ')}`]:[]};
}
