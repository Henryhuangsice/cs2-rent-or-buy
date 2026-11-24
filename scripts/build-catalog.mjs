// UU 行情：2026-11-23 人工抄录自 youpin898.com 公开首页（未登录、未抓接口）。
// 海外波动参考：Skinport 公开 API（无需登录）。en 仅填写能确认对应关系的饰品。
import { writeFileSync } from 'node:fs';
const U = [ // id, 中文名, 别名, 售价, 押金, 日租起价, 英文名
  ['awp-wildfire','AWP | 野火（久经沙场）',['野火'],210,350,0.14,'AWP | Wildfire (Field-Tested)'],
  ['ursus-urban','熊刀 | 都市伪装（久经沙场）',['熊刀','都市伪装'],356.5,500,0.4,'★ Ursus Knife | Urban Masked (Field-Tested)'],
  ['m4a4-recoil','M4A4 | 反冲精英（略有磨损）',['反冲精英'],235,366,0.22,null],
  ['flip-tiger','折叠刀 | 虎牙（崭新出厂）',['折叠刀','虎牙'],1084.49,1600,1.05,'★ Flip Knife | Tiger Tooth (Factory New)'],
  ['butterfly-auto','蝴蝶刀 | 自动化（久经沙场）',['蝴蝶刀','蝴蝶'],3798.88,5000,3.5,'★ Butterfly Knife | Autotronic (Field-Tested)'],
  ['talon-ch','锯齿爪刀 | 表面淬火（破损不堪）',['锯齿爪刀','锯齿爪','表面淬火'],2138.03,2784,2.02,'★ Talon Knife | Case Hardened (Well-Worn)'],
  ['glock-track','格洛克18型 | 追踪锁定（久经沙场）',['追踪锁定','格洛克'],5.3,6.41,0.01,null],
  ['falchion-auto','弯刀 | 自动化（久经沙场）',['弯刀'],497.5,697.9,0.44,'★ Falchion Knife | Autotronic (Field-Tested)'],
  ['deagle-seesaw','沙漠之鹰 | 跷跷板（略有磨损）',['跷跷板','沙鹰','沙漠之鹰'],2.7,3.4,0.01,null],
  ['fn57-fairy','FN57 | 童话城堡（略有磨损）',['童话城堡','fn57'],200.5,321,0.13,'Five-SeveN | Fairy Tale (Minimal Wear)'],
  ['ak-redline-mw','AK-47 | 红线（略有磨损）',['略磨红线','红线略磨','红线略有磨损'],607.5,838.81,0.47,'AK-47 | Redline (Minimal Wear)'],
  ['ak-bloodsport','AK-47 | 血腥运动（略有磨损）',['血腥运动'],579.5,720,0.45,'AK-47 | Bloodsport (Minimal Wear)'],
  ['ak-redline-ft','AK-47 | 红线（久经沙场）',['久经红线','红线久经','红线久经沙场'],148.5,190.8,0.08,'AK-47 | Redline (Field-Tested)'],
  ['navaja-doppler','折刀 | 多普勒（崭新出厂）',['折刀','多普勒'],582.5,791.38,0.65,'★ Navaja Knife | Doppler (Factory New)'],
  ['awp-gold-snake','AWP | 金粉肆蛇（久经沙场）',['金粉肆蛇'],17.5,22.26,0.01,null],
];
const names = U.map(r=>r[6]).filter(Boolean);
const r = await fetch('https://api.skinport.com/v1/sales/history?'+new URLSearchParams({app_id:'730',currency:'CNY',market_hash_name:names.join(',')}),{headers:{'Accept-Encoding':'br'}});
if(!r.ok) throw new Error('Skinport '+r.status);
const H = await r.json();
const items = U.map(([id,name,alias,price,deposit,daily,en])=>{
  const h = H.filter(x=>x.market_hash_name===en).sort((a,b)=>(b.last_30_days.volume||0)-(a.last_30_days.volume||0))[0];
  // 有版本号的饰品（多普勒等）价格按版本差异大，不作参考；成交太少的也不作参考
  const ok = h && !h.version && h.last_30_days.volume>=10;
  const ref = ok ? {m30:h.last_30_days.median,m90:h.last_90_days.median,vol30:h.last_30_days.volume} : null;
  console.log(name,price,ref);
  return {id,name,alias,price,deposit,daily,en,ref};
});
writeFileSync(new URL('../data/catalog.json',import.meta.url),JSON.stringify({uuCapturedOn:'2026-11-23',uuSource:'https://www.youpin898.com/',skinportFetchedAt:new Date().toISOString(),items},null,1));
