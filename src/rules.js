// 规则库：只收录读过原文的条款；conf=low 的只作参数默认值。
export const RULES = [
  { id: 'steam-protect', conf: 'high', src: 'https://help.steampowered.com/en/faqs/view/365F-4BEE-2AE2-7BDD', keys: ['保护','7天','七天','冷却'], text: 'CS2 饰品交易后 7 天为交易保护期：可以装备使用，但不可消耗、修改或转移。' },
  { id: 'steam-reverse', conf: 'high', src: 'https://help.steampowered.com/en/faqs/view/365F-4BEE-2AE2-7BDD', keys: ['撤回','撤销'], text: '撤销会同时撤回近 7 天全部受保护交易，发起方被限制交易和市场 30 天。' },
  { id: 'uu-overdue', conf: 'high', src: '悠悠有品《租赁服务协议》4.2、6.2（2026-01-11 生效）', keys: ['逾期','晚还','忘记还','超时'], text: '到期后有 12 小时归还时间；超出后每逾期一日按 3 倍租金计违约金，不足一日按一日。' },
  { id: 'uu-force-buyout', conf: 'high', src: '悠悠有品《租赁服务协议》6.1(5)、6.3', keys: ['强制','不还'], text: '恶意逾期三日未归还或库存无租赁饰品，视为同意买断。' },
  { id: 'uu-buyout', conf: 'high', src: '悠悠有品《租赁服务协议》3.6', keys: ['买断'], text: '自主买断需支付押金金额、已租天数租金和所选增值服务费。' },
  { id: 'uu-early', conf: 'high', src: '悠悠有品《租赁服务协议》4.3', keys: ['提前'], text: '原则上不得提前归还；确需提前归还仍按订单全额支付租金。' },
  { id: 'uu-sublet', conf: 'high', src: '悠悠有品《租赁服务协议》2.2、6.1(2)(3)', keys: ['转租','改名','印花','贴纸'], text: '承租方不得转租、转移或出售饰品，也不得修改印花、名称等属性。' },
  { id: 'uu-deposit', conf: 'high', src: '悠悠有品《租赁服务协议》3.4', keys: ['押金','免押','芝麻'], text: '免押额度由支付宝芝麻信用资质决定，额度以外的押金需自行支付。' },
];
export const findRules = (q) => RULES.filter((r) => r.keys.some((k) => q.includes(k)));
