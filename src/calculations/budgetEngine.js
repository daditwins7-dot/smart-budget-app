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
  const controlledExpenses = committedDebts + householdExpenses + extraordinaryExpenses;

  const resources = initialCashFlow + regularIncome + irregularIncome;
  const availableBeforeCreditCards =
    initialCashFlow +
    regularIncome +
    irregularIncome -
    budgetedSavings -
    desiredFinalCashFlow;
  const creditCardOverdraft = Math.max(0, controlledExpenses - availableBeforeCreditCards);
  const creditCardTotal = plannedCreditCardSpending + creditCardOverdraft;
  const budgetAvailableForExpenses = availableBeforeCreditCards + creditCardTotal;
  const miscellaneousRaw = budgetAvailableForExpenses - controlledExpenses;
  const miscellaneous = miscellaneousRaw;

  const actualIncome = actualTotal(state, "income");
  const actualSavings = actualTotal(state, "saving");
  const actualCardPayments = actualTotal(state, "creditCardPayment");
  const actualCashExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "cash")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const actualCardSpending = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "creditCard")
    .reduce((total, tx) => total + numeric(tx.amount), 0);

  const projectedIncome = Math.max(regularIncome + irregularIncome, actualIncome);
  const projectedSavingsDeposit = Math.max(budgetedSavings, actualSavings);
  const projectedCardCoverage = Math.max(plannedCreditCardSpending, actualCardSpending);
  const trackedCurrentCash =
    initialCashFlow + actualIncome - actualCashExpenses - actualSavings - actualCardPayments;
  const reviewCashVariance = numeric(state.currentCashFlow) - trackedCurrentCash;
  const projectedAvailableForExpenses =
    initialCashFlow +
    projectedIncome -
    projectedSavingsDeposit -
    desiredFinalCashFlow +
    projectedCardCoverage +
    reviewCashVariance;
  const projectedCommittedDebts = projectedGroupTotal(state, "debts");
  const projectedHouseholdExpenses = projectedGroupTotal(state, "household");
  const projectedExtraordinaryExpenses = projectedGroupTotal(state, "extraordinary");
  const miscellaneousProjected =
    projectedAvailableForExpenses -
    projectedCommittedDebts -
    projectedHouseholdExpenses -
    projectedExtraordinaryExpenses;
  const expectedEndCashFlow = desiredFinalCashFlow + Math.min(0, miscellaneousProjected);
  const projectedSavings = Math.max(numeric(state.currentSavings), numeric(state.initialSavings) + budgetedSavings);
  const totalIncomeBudget = regularIncome + irregularIncome;
  const totalExpensesBudget = committedDebts + householdExpenses + extraordinaryExpenses + miscellaneous;
  const totalProjectedExpenses =
    projectedCommittedDebts +
    projectedHouseholdExpenses +
    projectedExtraordinaryExpenses +
    miscellaneousProjected;
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
    budgetAvailableForExpenses,
    projectedAvailableForExpenses,
    totalExpensesBudget,
    totalProjectedExpenses,
    committedDebts,
    householdExpenses,
    extraordinaryExpenses,
    miscellaneousRaw,
    miscellaneous,
    miscellaneousProjected,
    expectedEndCashFlow,
    projectedSavings,
    creditCardPlanned: plannedCreditCardSpending,
    creditCardOverdraft,
    creditCardTotal,
    creditCardActual: actualCardSpending,
    creditCardPaymentsActual: actualCardPayments,
    projectedCardCoverage,
    reviewCashVariance,
    budgetBalanceDifference: budgetAvailableForExpenses - totalExpensesBudget,
    projectedBalanceDifference: projectedAvailableForExpenses - totalProjectedExpenses,
    debtToIncome,
    healthScore,
    alerts: buildAlerts(state, miscellaneousRaw, miscellaneousProjected, projectedSavings, today),
  };
}

export function dashboardModel(state, today = new Date()) {
  const projection = calculateProjection(state, today);
  const targetSavings = numeric(state.initialSavings) + numeric(state.budgetedSavings);
  const netIncome = projection.totalIncomeBudget * (1 - numeric(state.estimatedTaxPercent) / 100);
  const creditCapacity = Math.max(0, netIncome * 0.43 - projection.committedDebts);
  const dpi = projection.debtToIncome * 100;
  const period = periodDetails(state.month, today);
  const conceptRows = [
    {
      label: "Income",
      budget: [{ label: "Budget", value: projection.budgetAvailableForExpenses }],
      projected: [{ label: "Projected", value: projection.projectedAvailableForExpenses }],
      evaluation: higherIsBetter(projection.projectedAvailableForExpenses, projection.budgetAvailableForExpenses),
    },
    {
      label: "Expenses",
      budget: [{ label: "Budget", value: projection.totalExpensesBudget }],
      projected: [{ label: "Projected", value: projection.totalProjectedExpenses }],
      evaluation: lowerIsBetter(projection.totalProjectedExpenses, projection.totalExpensesBudget),
    },
    {
      label: "Cash Flow",
      budget: [{ label: "Initial", value: numeric(state.initialCashFlow) }],
      projected: [
        { label: "Actual", value: numeric(state.currentCashFlow) },
        { label: "End", value: projection.expectedEndCashFlow },
      ],
      evaluation: higherIsBetter(projection.expectedEndCashFlow, numeric(state.desiredFinalCashFlow)),
    },
    {
      label: "Savings",
      budget: [
        { label: "Initial", value: numeric(state.initialSavings) },
        { label: "Budget", value: numeric(state.budgetedSavings) },
      ],
      projected: [{ label: "Projected", value: projection.projectedSavings }],
      evaluation: higherIsBetter(projection.projectedSavings, targetSavings),
    },
  ];
  const expenseStructureRows = [
    expenseStructureRow(state, "Committed Debts", "debts"),
    expenseStructureRow(state, "Household", "household"),
    expenseStructureRow(state, "Extraordinary", "extraordinary"),
    {
    label: "Miscellaneous",
    budget: projection.miscellaneous,
    projected: projection.miscellaneousProjected,
    evaluation:
      projection.miscellaneousRaw < 0 || projection.miscellaneousProjected < 0
        ? status("problem")
        : lowerIsBetter(projection.miscellaneousProjected, projection.miscellaneous),
    },
  ];
  const creditCardStructure = {
    label: "Credit Cards",
    budget: projection.creditCardPlanned,
    overdraft: projection.creditCardOverdraft,
    total: projection.creditCardTotal,
    evaluation: projection.creditCardOverdraft > 0 ? status("problem") : status("good"),
  };

  return {
    projection,
    period,
    creditCapacity,
    dpi,
    indicatorPosition: clamp((projection.debtToIncome / 0.6) * 100, 0, 100),
    financialStatus:
      projection.debtToIncome <= 0.35
        ? status("good")
        : projection.debtToIncome <= 0.43
          ? status("watch")
          : status("problem"),
    conceptRows,
    expenseStructureRows,
    creditCardStructure,
  };
}

export function projectionRows(state) {
  const groups = [
    {
      label: "Income",
      group: null,
      details: [
        { id: "net-income", label: "Net Income", budget: numeric(state.regularIncome) },
        { id: "other-deposits", label: "Other Deposits", budget: numeric(state.irregularIncome) },
      ],
    },
    { label: "Committed Debts", group: "debts" },
    { label: "Household Expenses", group: "household" },
    { label: "Extraordinary Expenses", group: "extraordinary" },
  ];
  return groups.map(({ label, group, details }) => {
    const lines =
      details ||
      state.expenses
        .filter((line) => line.group === group)
        .map((line) => ({ id: line.id, label: line.concept, budget: numeric(line.amount) }));
    const ids = lines.map((line) => line.id);
    const budget = lines.reduce((total, line) => total + line.budget, 0);
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
      evaluation: group === null ? higherIsBetter(actual, budget) : lowerIsBetter(actual, budget),
      details: lines.map((line) => projectionDetail(state, line, group === null)),
    };
  });
}

export function projectionAnalysisModel(state) {
  const projection = calculateProjection(state);
  const savingsTarget = numeric(state.initialSavings) + numeric(state.budgetedSavings);
  const cardPayments = paidForConcept(state, "cards");
  const cardExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "creditCard" && tx.conceptId !== "cards")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const cardDifference = cardPayments - cardExpenses;
  const miscellaneousDifference = projection.miscellaneous - projection.miscellaneousProjected;
  return {
    balanceRows: [
      {
        label: "Cash Flow",
        initial: numeric(state.initialCashFlow),
        actual: numeric(state.currentCashFlow),
        projected: projection.expectedEndCashFlow,
        evaluation: higherIsBetter(projection.expectedEndCashFlow, numeric(state.desiredFinalCashFlow)),
      },
      {
        label: "Savings",
        initial: numeric(state.initialSavings),
        actual: numeric(state.currentSavings),
        projected: projection.projectedSavings,
        evaluation: higherIsBetter(projection.projectedSavings, savingsTarget),
      },
    ],
    rows: projectionRows(state),
    specialRows: [
      {
        label: "Miscellaneous",
        payments: projection.miscellaneous,
        expenses: projection.miscellaneousProjected,
        difference: miscellaneousDifference,
        evaluation:
          projection.miscellaneousProjected < 0
            ? status("problem")
            : lowerIsBetter(projection.miscellaneousProjected, projection.miscellaneous),
      },
      {
        label: "Credit Cards",
        payments: cardPayments,
        expenses: cardExpenses,
        difference: cardDifference,
        evaluation: cardDifference < 0 ? status("problem") : status("good"),
      },
    ],
  };
}

function projectionDetail(state, line, income) {
  const actual = income
    ? state.transactions
        .filter((tx) => tx.type === "income" && tx.conceptId === line.id)
        .reduce((total, tx) => total + numeric(tx.amount), 0)
    : paidForConcept(state, line.id);
  return {
    label: line.label,
    budget: line.budget,
    actual,
    projected: Math.max(line.budget, actual),
    remaining: Math.max(0, line.budget - actual),
    paid: line.budget ? actual / line.budget : 0,
    evaluation: income ? higherIsBetter(actual, line.budget) : lowerIsBetter(actual, line.budget),
  };
}

function periodDetails(month, today) {
  const selectedMonth = new Date(`${month}-01T12:00:00`);
  const reference = Number.isNaN(selectedMonth.getTime()) ? today : selectedMonth;
  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const sameMonth = year === today.getFullYear() && monthIndex === today.getMonth();
  const elapsedDays = sameMonth ? Math.min(today.getDate(), totalDays) : today > reference ? totalDays : 0;
  return {
    monthLabel: reference.toLocaleString("en-US", { month: "long", year: "numeric" }),
    dateLabel: today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    remainingDays: Math.max(0, totalDays - elapsedDays),
  };
}

function actualTotal(state, type) {
  return state.transactions
    .filter((tx) => tx.type === type)
    .reduce((total, tx) => total + numeric(tx.amount), 0);
}

function higherIsBetter(value, target) {
  if (!target || value >= target) return status("good");
  if (value >= target * 0.9) return status("watch");
  return status("problem");
}

function lowerIsBetter(value, target) {
  if (!target || value <= target) return status("good");
  if (value <= target * 1.1) return status("watch");
  return status("problem");
}

function expenseStructureRow(state, label, group) {
  const lines = state.expenses.filter((line) => line.group === group);
  const budget = sum(lines);
  const actual = lines.reduce((total, line) => total + paidForConcept(state, line.id), 0);
  const projected = Math.max(budget, actual);
  return {
    label,
    budget,
    projected,
    evaluation: lowerIsBetter(projected, budget),
  };
}

function projectedGroupTotal(state, group) {
  const lines = state.expenses.filter((line) => line.group === group);
  return lines.reduce((total, line) => {
    const budget = numeric(line.amount);
    return total + Math.max(budget, paidForConcept(state, line.id));
  }, 0);
}

function status(key) {
  const labels = {
    problem: "Problem",
    watch: "Watch",
    good: "On track",
  };
  return { key, label: labels[key] };
}

function paidForConcept(state, conceptId) {
  return state.transactions
    .filter((tx) => tx.conceptId === conceptId)
    .reduce((total, tx) => total + numeric(tx.amount), 0);
}

function buildAlerts(state, miscellaneousRaw, miscellaneousProjected, projectedSavings, today) {
  const alerts = [];
  if (miscellaneousRaw < 0) alerts.push("Budget deficit: miscellaneous is negative before adjustment.");
  if (state.crisisMode && miscellaneousRaw < 0) {
    alerts.push("Crisis mode: keep the deficit visible until a revised budget is confirmed.");
  }
  if (miscellaneousProjected < 0) alerts.push("Projected deficit: current cash balance reduces miscellaneous below zero.");
  if (state.savingsDepositDay < today.getDate() && numeric(state.currentSavings) < projectedSavings) {
    alerts.push("Savings deposit date passed and current savings does not reflect the budgeted deposit.");
  }
  if (numeric(state.currentCashFlow) < 0) alerts.push("Current cash flow is below zero.");
  return alerts;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
