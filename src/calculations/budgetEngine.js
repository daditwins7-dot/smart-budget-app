export function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function pct(value) {
  return `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
}

export function sum(lines, group) {
  return lines
    .filter((line) => !group || line.group === group)
    .reduce((total, line) => total + numeric(line.amount), 0);
}

export function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateProjection(state, today = new Date()) {
  const regularIncome = numeric(state.regularIncome);
  const irregularIncome = numeric(state.irregularIncome);
  const committedDebts = sum(state.expenses, "debts");
  const householdExpenses = sum(state.expenses, "household");
  const extraordinaryExpenses = sum(state.expenses, "extraordinary");
  const budgetedSavings = numeric(state.budgetedSavings);
  const initialCashFlow = numeric(state.initialCashFlow);
  const desiredFinalCashFlow = numeric(state.desiredFinalCashFlow);
  const plannedCreditCardSpending = numeric(state.plannedCreditCardSpending);

  const resources = initialCashFlow + regularIncome + irregularIncome;
  const miscellaneousRaw =
    initialCashFlow +
    regularIncome +
    irregularIncome -
    committedDebts -
    householdExpenses -
    extraordinaryExpenses -
    budgetedSavings +
    plannedCreditCardSpending -
    desiredFinalCashFlow;
  const miscellaneous = miscellaneousRaw < 0 && state.crisisMode ? 0 : miscellaneousRaw;

  const actualIncome = actualTotal(state, "income");
  const actualSavings = actualTotal(state, "saving");
  const actualCardPayments = actualTotal(state, "creditCardPayment");
  const actualCashExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "cash")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const actualCardSpending = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "creditCard")
    .reduce((total, tx) => total + numeric(tx.amount), 0);

  const remainingDue = state.expenses
    .filter((line) => isStillDue(line.dueDay, today) && paidForConcept(state, line.id) < numeric(line.amount))
    .reduce((total, line) => total + Math.max(0, numeric(line.amount) - paidForConcept(state, line.id)), 0);

  const projectedIncome = Math.max(regularIncome + irregularIncome, actualIncome);
  const projectedExpenses =
    committedDebts + householdExpenses + extraordinaryExpenses + Math.max(0, miscellaneous);
  const currentCashFlow = numeric(state.currentCashFlow);
  const expectedEndCashFlow =
    currentCashFlow +
    Math.max(0, projectedIncome - actualIncome) -
    remainingDue -
    Math.max(0, budgetedSavings - actualSavings) +
    Math.max(0, plannedCreditCardSpending - actualCardSpending);
  const projectedSavings = Math.max(numeric(state.currentSavings), numeric(state.initialSavings) + budgetedSavings);
  const totalIncomeBudget = regularIncome + irregularIncome;
  const totalExpensesBudget = committedDebts + householdExpenses + extraordinaryExpenses + Math.max(0, miscellaneous);
  const debtToIncome = totalIncomeBudget ? committedDebts / totalIncomeBudget : 0;
  const savingsRatio = totalIncomeBudget ? budgetedSavings / totalIncomeBudget : 0;
  const deficitPenalty = miscellaneousRaw < 0 ? 25 : 0;
  const dtiPenalty = debtToIncome > 0.43 ? 25 : debtToIncome > 0.35 ? 12 : 0;
  const savingsBonus = savingsRatio >= 0.1 ? 10 : savingsRatio >= 0.05 ? 4 : 0;
  const healthScore = clamp(72 + savingsBonus - deficitPenalty - dtiPenalty, 0, 100);

  return {
    resources,
    totalIncomeBudget,
    totalProjectedIncome: projectedIncome,
    totalExpensesBudget,
    totalProjectedExpenses: projectedExpenses,
    committedDebts,
    householdExpenses,
    extraordinaryExpenses,
    miscellaneousRaw,
    miscellaneous,
    expectedEndCashFlow,
    projectedSavings,
    creditCardPlanned: plannedCreditCardSpending,
    creditCardActual: actualCardSpending,
    creditCardPaymentsActual: actualCardPayments,
    debtToIncome,
    healthScore,
    alerts: buildAlerts(state, miscellaneousRaw, projectedSavings, today),
  };
}

export function projectionRows(state) {
  const groups = [
    ["Income", null, state.regularIncome + state.irregularIncome],
    ["Debts", "debts", sum(state.expenses, "debts")],
    ["Household expenses", "household", sum(state.expenses, "household")],
    ["Extraordinary expenses", "extraordinary", sum(state.expenses, "extraordinary")],
  ];
  return groups.map(([label, group, budget]) => {
    const ids = state.expenses.filter((line) => line.group === group).map((line) => line.id);
    const actual =
      group === null
        ? actualTotal(state, "income")
        : state.transactions
            .filter((tx) => ids.includes(tx.conceptId))
            .reduce((total, tx) => total + numeric(tx.amount), 0);
    return {
      label,
      budget,
      actual,
      projected: Math.max(budget, actual),
      remaining: Math.max(0, budget - actual),
      paid: budget ? actual / budget : 0,
    };
  });
}

function actualTotal(state, type) {
  return state.transactions
    .filter((tx) => tx.type === type)
    .reduce((total, tx) => total + numeric(tx.amount), 0);
}

function paidForConcept(state, conceptId) {
  return state.transactions
    .filter((tx) => tx.conceptId === conceptId)
    .reduce((total, tx) => total + numeric(tx.amount), 0);
}

function isStillDue(dueDay, today) {
  return numeric(dueDay) >= today.getDate();
}

function buildAlerts(state, miscellaneousRaw, projectedSavings, today) {
  const alerts = [];
  if (miscellaneousRaw < 0) alerts.push("Budget deficit: miscellaneous is negative before adjustment.");
  if (state.savingsDepositDay < today.getDate() && numeric(state.currentSavings) < projectedSavings) {
    alerts.push("Savings deposit date passed and current savings does not reflect the budgeted deposit.");
  }
  if (numeric(state.currentCashFlow) < 0) alerts.push("Current cash flow is below zero.");
  return alerts;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
