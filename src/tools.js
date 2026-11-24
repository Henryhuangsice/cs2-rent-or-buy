import { decide } from './engine.js';
import { findRules, RULES } from './rules.js';
// 工具注册表：参数校验失败返回结构化错误，不抛给用户。
export function makeTools(catalog, assumptions) {
  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  return {
    quote: ({ itemId }) => { const i = byId.get(itemId); return i ? { ok: true, data: { id: i.id, name: i.name, price: i.price, deposit: i.deposit, daily: i.daily, capturedOn: catalog.uuCapturedOn } } : { ok: false, error: 'UNKNOWN_ITEM' }; },
    compare: (p) => {
      const i = byId.get(p.itemId);
      if (!i) return { ok: false, error: 'UNKNOWN_ITEM' };
      if (!(p.days > 0 && p.days <= 730)) return { ok: false, error: 'BAD_DAYS' };
      if (p.budget != null && !(p.budget >= 0)) return { ok: false, error: 'BAD_BUDGET' };
      return { ok: true, data: decide(i, p, assumptions) };
    },
    rules: ({ text, ids = [] }) => ({ ok: true, data: [...new Set([...findRules(text), ...RULES.filter((r) => ids.includes(r.id))])] }),
  };
}
