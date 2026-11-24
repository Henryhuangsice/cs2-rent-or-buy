import { readFileSync, writeFileSync } from 'node:fs';
import { run, groundedNumbers, consistent, templateExplain } from '../src/harness.js';
import { openaiCompatible } from '../src/llm.js';
import { parseRequest } from '../src/parse.js';
const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const catalog = J('../data/catalog.json'), cases = J('./cases.json');
const match = (r, e) => r.status === e.status && (!e.ask || r.ask === e.ask) && (!e.code || r.code === e.code) &&
  (!e.item || r.parsed?.itemIds[0] === e.item) && ['days', 'budget', 'intent', 'depositFree'].every((k) => !(k in e) || r.parsed?.[k] === e[k]);

const { LLM_BASE_URL: baseUrl, LLM_API_KEY: apiKey, LLM_MODEL: name } = process.env;
const live = baseUrl && name ? openaiCompatible({ baseUrl, apiKey, model: name }) : null;
const score = async (model, label, cases) => { const fails = []; for (const [t, e] of cases) { const r = await run(t, { catalog, model }); if (!match(r, e)) fails.push({ t, e, got: { status: r.status, ask: r.ask, code: r.code, ...r.parsed } }); }
  console.log(`[行为] ${label}: ${cases.length - fails.length}/${cases.length}`); fails.forEach((f) => console.log('  ✗', JSON.stringify(f))); return { label, pass: cases.length - fails.length, n: cases.length, fails }; };
const sets = { dev: cases, holdout: J('./holdout.json') };
const out = { behaviour: [] };
for (const [k, c] of Object.entries(sets)) { out.behaviour.push(await score(null, `离线规则 ${k}`, c)); if (live) out.behaviour.push(await score(live, `${name} ${k}`, c)); }

// 故障注入：模拟模型的典型坏输出，比较 harness 开/关校验时“坏结果到达用户”的比例
const P = (f) => async ({ text, items }) => f(parseRequest(text, items));
const good = async ({ decision }) => templateExplain(decision);
const FAULTS = {
  '编造数字': { parse: P((x) => x), explain: async ({ opening }) => `${opening}平均每天只要 ¥0.0123，预计节省 ¥8888.88。` },
  '篡改结论': { parse: P((x) => x), explain: async ({ opening }) => (opening.includes('租') ? '结论：直接买。' : '结论：租。') + '这样更省。' },
  '虚构饰品 ID': { parse: P((x) => ({ ...x, itemIds: ['awp-dragon-lore'] })), explain: good },
  '天数类型错误': { parse: P((x) => ({ ...x, days: '很久' })), explain: good },
  '选错饰品（合法 ID）': { parse: P((x) => ({ ...x, itemIds: ['ak-redline-ft'] })), explain: good },
  '天数读错': { parse: P((x) => ({ ...x, days: x.days + 5 })), explain: good },
  '解析抛错': { parse: async () => JSON.parse('{bad'), explain: good },
  '解析超时': { parse: () => new Promise(() => {}), explain: good },
  '解释空输出': { parse: P((x) => x), explain: async () => '' },
};
const req = catalog.items.slice(0, 10).flatMap((i) => [10, 120].map((d) => ({ t: `${i.name}用${d}天`, id: i.id, d })));
out.faults = {};
for (const [k, model] of Object.entries(FAULTS)) { const row = {};
  for (const verify of [false, true]) { let bad = 0, calls = 0;
    for (const q of req) { const r = await run(q.t, { catalog, model, verify, timeoutMs: 15 }); calls += r.llmCalls;
      const okay = r.status === 'clarify' || r.status === 'ok' && r.decision.days === q.d && r.parsed.itemIds[0] === q.id && !groundedNumbers(r.message, r.decision).length && consistent(r.message, r.decision);
      if (!okay) bad++; }
    row[verify ? 'on' : 'off'] = { bad, n: req.length, avgCalls: calls / req.length }; }
  out.faults[k] = row; console.log(`[故障] ${k}: 无校验 坏结果 ${row.off.bad}/${row.off.n} → 有校验 ${row.on.bad}/${row.on.n}（平均调用 ${row.on.avgCalls}）`); }
out.ranAt = new Date().toISOString();
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(out, null, 1));
