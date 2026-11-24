import { guard } from './guard.js';
import { parseRequest } from './parse.js';
import { makeTools } from './tools.js';
import { ASSUMPTIONS } from './engine.js';

// GUARD → PARSE(LLM,可降级) → VALIDATE → CLARIFY? → TOOLS → EXPLAIN(LLM) → VERIFY → 输出或模板降级
const PICK = { rent: '租', resell: '买入，用完再卖', buy: '直接买', wait: '先不买断，等预算够再直接买', none: '当前预算两种方式都不够' };
const pct = (x) => `${Math.round(Math.abs(x) * 1000) / 10}%`;

export function templateExplain(d) {
  const L = [`结论：${PICK[d.pick]}。`];
  if (d.intent === 'use') L.push(`租 ${d.days} 天按 ${d.rent.billedDays} 天计费约 ¥${d.rent.total}；价格不变时买后再卖约损失 ¥${d.scenarios[1].total}。`);
  if (d.why.includes('SENSITIVE')) L.push(`但如果期间价格${d.pick === 'rent' ? '上涨' : '下跌'} ${pct(d.width)}，另一种方式更省。`);
  if (d.intent === 'use' && d.pick !== 'none' && d.why.includes('MIN_LEASE')) L.push(`注意：受 7 天交易保护影响，最早约第 ${d.rent.billedDays} 天才能归还，会多付 ${d.rent.extraDays} 天租金。`);
  if (d.why.includes('BUYOUT_PREMIUM')) L.push(`不要先租再买断：按租 ${d.days} 天算，买断约 ¥${d.buyout.total}，比直接买多 ¥${d.buyout.extraVsBuy}。`);
  if (d.why.includes('DEPOSIT_SHORT')) L.push(`你的预算不够同时冻结押金和租金（共 ¥${d.rentCash}）。`);
  if (d.why.includes('BUDGET_SHORT')) L.push(`租需占用 ¥${d.rentCash}，直接买需 ¥${d.scenarios[1].upfront}。`);
  return L.join('');
}

// 数字溯源：解释里每个数字都必须能在工具结果中找到
export function groundedNumbers(text, d) {
  const ok = new Set(['7', '12', '30', '3']);
  const walk = (v) => {
    if (typeof v === 'number') { for (const x of [v, Math.abs(v), Math.round(Math.abs(v) * 1000) / 10]) ok.add(String(x)); }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    else if (typeof v === 'string') (v.match(/\d+(?:\.\d+)?/g) ?? []).forEach((x) => ok.add(x));
  };
  walk(d);
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).filter((x) => !ok.has(x) && !ok.has(String(Number(x))));
}
// 结论一致：首句必须与引擎结论相同
export const consistent = (text, d) => text.startsWith(`结论：${PICK[d.pick]}。`);

function validParse(p, items) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.itemIds)) return false;
  if (p.itemIds.some((id) => !items.some((i) => i.id === id))) return false;
  if (p.days != null && !(typeof p.days === 'number' && p.days > 0)) return false;
  if (p.budget != null && !(typeof p.budget === 'number' && p.budget >= 0)) return false;
  return ['use', 'keep'].includes(p.intent) && typeof p.depositFree === 'boolean';
}
const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, j) => { t = setTimeout(() => j(new Error('TIMEOUT')), ms); })]).finally(() => clearTimeout(t)); };

export async function run(text, { catalog, model = null, budget = 3, timeoutMs = 15000, verify = true, assumptions = ASSUMPTIONS, overrides = {} }) {
  const trace = [], tools = makeTools(catalog, assumptions);
  let calls = 0;
  const log = (step, info) => trace.push({ n: trace.length + 1, step, ...info });
  const done = (o) => ({ ...o, trace, llmCalls: calls });
  const llm = async (kind, payload) => {
    if (!model || calls >= budget) return null;
    calls++;
    try { return await withTimeout(model[kind](payload), timeoutMs); }
    catch (e) { log('LLM_ERROR', { kind, error: String(e.message ?? e) }); return null; }
  };

  const g = guard(text);
  log('GUARD', { blocked: g?.id ?? null });
  if (g) return done({ status: 'blocked', code: g.id, message: g.msg });

  let p = await llm('parse', { text, items: catalog.items }), by = 'llm';
  if (verify ? !validParse(p, catalog.items) : !p) {
    if (model) log('PARSE_FALLBACK', { reason: p ? 'SCHEMA' : 'NO_OUTPUT' });
    p = parseRequest(text, catalog.items); by = 'rules';
  }
  // 交叉核对：模型给出合法但与规则解析冲突的关键槽位时，不猜，改为向用户确认
  if (verify && by === 'llm') {
    const q = parseRequest(text, catalog.items);
    const clash = q.itemIds.length === 1 && (p.itemIds.length !== 1 || p.itemIds[0] !== q.itemIds[0]) ? 'item'
      : q.days != null && p.days != null && q.days !== p.days ? 'days' : null;
    if (clash) { log('CROSSCHECK', { clash, llm: p, rules: q }); return done({ status: 'clarify', ask: clash, message: clash === 'item' ? '想确认一下：你指的是哪件饰品？' : '想确认一下：打算用多少天？' }); }
  }
  p = { ...p, ...overrides };
  log('PARSE', { by, result: p });

  const rules = tools.rules({ text }).data;
  if (!p.itemIds.length && rules.length) { log('RULES', { ids: rules.map((r) => r.id) }); return done({ status: 'rule', rules, message: rules.map((r) => r.text).join('\n') }); }
  if (!p.itemIds.length) return log('CLARIFY', { ask: 'item' }), done({ status: 'clarify', ask: 'item', message: '目前只收录了 15 件示例饰品，请从列表里选一件。' });
  if (p.itemIds.length > 1) return log('CLARIFY', { ask: 'which' }), done({ status: 'clarify', ask: 'which', options: p.itemIds, message: '有多件匹配（磨损不同价格差很多），你指哪一件？' });
  if (p.days == null && p.intent === 'keep') p.days = assumptions.minLeaseDays;
  if (p.days == null) return log('CLARIFY', { ask: 'days' }), done({ status: 'clarify', ask: 'days', itemId: p.itemIds[0], message: '打算用多少天？天数会直接改变结论。' });

  const args = { itemId: p.itemIds[0], days: p.days, intent: p.intent, budget: p.budget, depositFree: p.depositFree };
  const c = tools.compare(args);
  log('TOOL compare', { args, ok: c.ok, error: c.error, pick: c.data?.pick });
  if (!c.ok) return done({ status: 'error', code: c.error, message: c.error === 'BAD_DAYS' ? '天数需在 1–730 之间。' : '参数无效。' });
  const d = c.data;
  const ids = ['steam-protect', 'uu-overdue', ...(d.intent === 'keep' ? ['uu-buyout'] : ['uu-early'])];
  const cites = tools.rules({ text, ids }).data;
  log('TOOL rules', { ids: cites.map((r) => r.id) });

  let msg = null, src = 'template', feedback = null;
  for (let i = 0; i < 2 && model; i++) {
    const out = await llm('explain', { decision: d, cites, opening: `结论：${PICK[d.pick]}。`, feedback });
    if (typeof out !== 'string' || !out.trim()) break;
    const bad = groundedNumbers(out, d), same = consistent(out, d);
    log('VERIFY', { ungrounded: bad, consistent: same });
    if (!verify || (!bad.length && same)) { msg = out; src = 'llm'; break; }
    feedback = { ungrounded: bad, consistent: same };
  }
  if (!msg) { msg = templateExplain(d); if (model) log('EXPLAIN_FALLBACK', { to: 'template' }); }
  log('DONE', { source: src, llmCalls: calls });
  return done({ status: 'ok', decision: d, cites, message: msg, source: src, parsed: p });
}
