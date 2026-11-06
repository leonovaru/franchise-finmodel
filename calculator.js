/* Расчётное ядро прототипа франшизы «ПожзнакЪ».
   Кредитование исключено. Формулы опираются на исходную книгу; налог 15% остаётся предварительным. */
(function () {
  'use strict';

  const SEASONALITY = [1.1, 1.1, 1, 1, 1.1, 1.2, 1, 1, 1.1, 1.2, 1, 1];
  const value = (p, key) => Math.max(0, Number(p[key]) || 0);
  const sumRows = rows => (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const amount = Math.max(0, Number(row.amount) || 0);
    const qty = Math.max(0, Number(row.qty) || 0);
    const price = Math.max(0, Number(row.price) || 0);
    return sum + (row.amount !== undefined ? amount : qty * price);
  }, 0);

  function investment(p) {
    return value(p, 'fee')
      + value(p, 'deposit')
      + value(p, 'area') * value(p, 'repair')
      + value(p, 'uniform')
      + value(p, 'hiring')
      + value(p, 'print')
      + sumRows(p.furnitureItems)
      + sumRows(p.officeItems)
      + sumRows(p.equipmentItems)
      + sumRows(p.startupItems);
    // Аренда первого месяца не включается в инвестиции: она уже учтена
    // в ежемесячных расходах, как в строке 35 исходного Excel.
  }

  function calculate(p) {
    const target = value(p, 'revenue');
    const ramp = Math.max(1, value(p, 'ramp'));
    const firstMonthLoad = Math.min(100, value(p, 'firstMonth')) / 100;
    const startValue = String(p.start || '2026-12').split('-');
    const startYear = Number(startValue[0]) || 2026;
    const startMonth = (Number(startValue[1]) || 12) - 1;
    const totalInvestment = investment(p);
    const serviceShare = (Array.isArray(p.services) ? p.services : [])
      .reduce((sum, item) => sum + Math.max(0, Number(item.share) || 0), 0) / 100;
    const months = [];
    let cumulative = -totalInvestment;

    for (let i = 0; i < 24; i++) {
      const date = new Date(startYear, startMonth + i, 1);
      const growth = Math.min(1, firstMonthLoad + ((1 - firstMonthLoad) * i / ramp));
      const season = p.seasonality === 'no' ? 1 : SEASONALITY[date.getMonth()];
      const revenue = target * growth * season * serviceShare;

      const technicalPayroll = i === 0 ? 0 : i <= 2
        ? value(p, 'tech') * 2
        : revenue * 0.25;
      const insurance = i < 2 ? 26100 : 34800;
      const royalty = i === 0 ? 0 : value(p, 'royalty');
      const rent = value(p, 'area') * value(p, 'rent');
      const managementPayroll = value(p, 'manager');
      const administrativePayroll = value(p, 'admin');
      const household = value(p, 'house');
      const communications = value(p, 'connection');
      const accounting = i === 0 ? 15000 : value(p, 'accounting');
      const printing = i === 0 ? value(p, 'print') : 0;
      const marketing = value(p, 'marketing');
      const contractors = value(p, 'contractors') + sumRows(p.monthlyItems);

      const expensesBeforeTax = rent + managementPayroll + administrativePayroll
        + technicalPayroll + insurance + royalty + household + communications
        + accounting + printing + marketing + contractors;

      // УСН 6% — формула исходной книги. УСН 15% — временное приближение,
      // пока заказчик не подтвердит налоговую методику и учёт страховых взносов.
      const taxRate = Number(p.tax) || 6;
      const tax = taxRate === 15
        ? Math.max(0, revenue - expensesBeforeTax) * 0.15
        : revenue * 0.06;

      const expenses = expensesBeforeTax + tax;
      const profit = revenue - expenses;
      cumulative += profit;
      months.push({
        label: date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
        revenue, expenses, profit, cumulative, tax,
        payroll: managementPayroll + administrativePayroll + technicalPayroll
      });
    }

    const totalRevenue = months.reduce((sum, month) => sum + month.revenue, 0);
    const totalExpenses = months.reduce((sum, month) => sum + month.expenses, 0);
    const totalProfit = months.reduce((sum, month) => sum + month.profit, 0);
    const paybackIndex = months.findIndex(month => month.cumulative >= 0);

    return {
      investment: totalInvestment,
      target,
      serviceShare: serviceShare * 100,
      totalRevenue,
      totalExpenses,
      totalProfit,
      avg: totalProfit / 24,
      payback: paybackIndex < 0 ? null : paybackIndex + 1,
      months
    };
  }

  window.FranchiseCalculator = { investment, calculate };
})();
