// 确定性决策引擎：所有金额只在这里计算，LLM 不做算术。
export const ASSUMPTIONS = {
  minLeaseDays: 8,      // 推断：收到后 7 天内不可转移，最早约第 8 天才能归还
  sellSpread: 0.02,     // 假设：为了卖出比市价低挂 2%
  withdrawFee: 0.01,    // 第三方资料，待 App 内核实
  withdrawFeeMin: 2,    // 同上
  rentMarkup: 0,        // 日租“起价”之上的上浮，例如 0.2 = 贵 20%
  overdueMultiplier: 3, // 租赁协议 6.2
  scenarioFloor: 0.1,   // 没有参考数据时的价格波动幅度
};
export const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export function rentCost(item, days, a = ASSUMPTIONS) {
  const billedDays = Math.max(Math.ceil(days), a.minLeaseDays);
  const daily = item.daily * (1 + a.rentMarkup);
  return { billedDays, daily: r2(daily), total: r2(daily * billedDays), extraDays: billedDays - Math.ceil(days),
    deposit: item.deposit, overduePerDay: r2(daily * a.overdueMultiplier) };
}

// 买入后在使用结束时卖出；priceChange 为期间价格变化
export function resellCost(item, priceChange = 0, a = ASSUMPTIONS) {
  const gross = item.price * (1 + priceChange) * (1 - a.sellSpread);
  const fee = Math.max(gross * a.withdrawFee, a.withdrawFeeMin);
  const net = Math.max(0, gross - fee);
  return { upfront: item.price, recovered: r2(net), fee: r2(fee), total: r2(item.price - net) };
}

// 先租后自主买断：租赁协议 3.6，押金 + 已租天数租金（增值服务费另计）
export function buyoutCost(item, days, a = ASSUMPTIONS) {
  const rent = r2(item.daily * (1 + a.rentMarkup) * Math.max(1, Math.ceil(days)));
  const total = r2(item.deposit + rent);
  return { total, rent, extraVsBuy: r2(total - item.price), depositPremium: r2(item.deposit / item.price - 1) };
}

export function scenarioWidth(item, a = ASSUMPTIONS) {
  const move = item.ref ? Math.abs(item.ref.m30 / item.ref.m90 - 1) : 0;
  return r2(Math.max(a.scenarioFloor, move));
}

export function breakEven(item, days, a = ASSUMPTIONS) {
  const flat = resellCost(item, 0, a).total;
  const daily = item.daily * (1 + a.rentMarkup);
  const beDays = daily > 0 ? Math.floor(flat / daily) : null;
  // 价格变化多少时“买后卖”与租一样贵（二分，手续费有最低额所以不用闭式解）
  const rent = rentCost(item, days, a).total;
  let lo = -1, hi = 2;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; resellCost(item, m, a).total > rent ? (lo = m) : (hi = m); }
  return { days: beDays, priceChange: Math.round(hi * 1000) / 1000 };
}

/** intent: 'use' 用完就走 | 'keep' 想长期拥有 */
export function decide(item, { days, intent = 'use', budget = null, depositFree = false }, a = ASSUMPTIONS) {
  const w = scenarioWidth(item, a);
  const rent = rentCost(item, days, a);
  const scenarios = [-w, 0, w].map((c) => ({ change: c, ...resellCost(item, c, a) }));
  const buyout = buyoutCost(item, days, a);
  const be = breakEven(item, days, a);
  const canBuy = budget == null || budget >= item.price;
  const rentCash = depositFree ? rent.total : r2(rent.total + item.deposit);
  const canRent = budget == null || budget >= rentCash;
  let pick, confidence, why = [];
  if (!canBuy && !canRent) { pick = 'none'; confidence = 'high'; why.push('BUDGET_SHORT'); }
  else if (intent === 'keep') {
    if (canBuy) { pick = 'buy'; confidence = 'high'; why.push('KEEP'); if (buyout.extraVsBuy > 0) why.push('BUYOUT_PREMIUM'); }
    else { pick = 'wait'; confidence = 'medium'; why.push('CANNOT_AFFORD_BUY'); }
  } else if (!canBuy) { pick = 'rent'; confidence = 'high'; why.push('CANNOT_AFFORD_BUY'); }
  else if (!canRent) { pick = 'resell'; confidence = 'medium'; why.push('DEPOSIT_SHORT'); }
  else {
    const wins = scenarios.filter((s) => rent.total < s.total).length;
    pick = rent.total < scenarios[1].total ? 'rent' : 'resell';
    confidence = wins === 3 || wins === 0 ? 'high' : 'low';
    why.push(confidence === 'high' ? 'ROBUST' : 'SENSITIVE');
  }
  if (rent.extraDays > 0) why.push('MIN_LEASE');
  return { item: item.name, days, intent, pick, confidence, why, rent, rentCash, scenarios, buyout, breakEven: be, width: w, canBuy, canRent };
}
