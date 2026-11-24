// 离线规则解析器：也是没有模型时的降级路径。
const CN = { 一:1, 两:2, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10, 半:0.5 };
const n = (s) => {
  if (/^\d/.test(s)) return Number(s);
  const i = s.indexOf('十');
  return i < 0 ? CN[s] : (i ? CN[s[0]] : 1) * 10 + (s[i + 1] ? CN[s[i + 1]] : 0);
};
const NUM = '(\\d+(?:\\.\\d+)?|[二三四五六七八九]?十[一二三四五六七八九]?|[一两二三四五六七八九半])';

const UNLISTED = /(?<!锯齿)爪子刀|龙狙|刺刀|匕首|手套/;

export function findItems(text, items) {
  const t = text.toLowerCase().replace(/\s/g, '');
  // 完整名称（去掉分隔符）优先
  const norm = (x) => x.toLowerCase().replace(/[\s|（）()]/g, '');
  const full = items.filter((i) => norm(t).includes(norm(i.name)) || (t.includes('红线') && i.name.includes('红线') && t.includes(i.name.match(/（(.+)）/)[1])));
  if (full.length) return full;
  const scored = [];
  for (const it of items) {
    const hit = it.alias.filter((a) => t.includes(a.toLowerCase())).sort((a, b) => b.length - a.length)[0];
    // “爪子刀”“龙狙”等未收录武器出现时，不用涂装名去猜
    if (hit && !UNLISTED.test(t)) scored.push({ it, len: hit.length });
  }
  // 锯齿爪刀 > 爪刀、折叠刀 ≠ 折刀：取最长别名
  const max = Math.max(0, ...scored.map((s) => s.len));
  const best = scored.filter((s) => s.len === max).map((s) => s.it);
  if (!best.length && t.includes('红线')) return items.filter((i) => i.name.includes('红线'));
  return best;
}
export function parseRequest(text, items) {
  const m = (re) => { const x = text.match(new RegExp(re)); return x ? n(x[1]) : null; };
  let days = m(NUM + '\\s*天'), v;
  if (days == null && /半年/.test(text)) days = 180;
  if (days == null && (v = m(NUM + '\\s*个半月')) != null) days = v * 30 + 15;
  if (days == null && (v = m(NUM + '\\s*个?月')) != null) days = v * 30;
  if (days == null && (v = m(NUM + '\\s*(?:个)?(?:周|星期|礼拜)')) != null) days = v * 7;
  if (days == null && (v = m(NUM + '\\s*年')) != null) days = v * 365;
  if (days == null && /周末/.test(text)) days = 2;
  const b = text.match(/(?:预算|只有|最多|手里有|手上有)\D{0,4}(\d+(?:\.\d+)?)\s*(万|千|k|w)?/i);
  const mul = { 万: 1e4, w: 1e4, 千: 1e3, k: 1e3 };
  return {
    itemIds: findItems(text, items).map((i) => i.id), days,
    intent: /长期(拥有|持有|收藏)|收藏|一直(用|留)|自己留|不打算卖|永久/.test(text) ? 'keep' : 'use',
    budget: b ? Number(b[1]) * (mul[b[2]?.toLowerCase()] ?? 1) : null,
    depositFree: /免押/.test(text) && !/(不能|不可以|没有|没法|没|无法|不支持)免押/.test(text),
  };
}
