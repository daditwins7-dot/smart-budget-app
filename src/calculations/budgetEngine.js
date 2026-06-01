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
  const timing = monthTiming(state.month, effectiveProjectionDate(state, today));
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
  const actualCardPayments = paidForConcept(state, "cards") + actualTotal(state, "creditCardPayment");
  const actualCashExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "cash")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const actualCardSpending = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "creditCard" && tx.conceptId !== "cards")
    .reduce((total, tx) => total + numeric(tx.amount), 0);

  const projectedIncome = Math.max(regularIncome + irregularIncome, actualIncome);
  const totalSavingsBudget = numeric(state.initialSavings) + budgetedSavings;
  const currentSavings = numeric(state.currentSavings);
  const currentCashFlow = numeric(state.currentCashFlow);
  const savingsDepositPassed = timing.currentDay > numeric(state.savingsDepositDay);
  const projectedSavings =
    savingsDepositPassed && currentSavings < totalSavingsBudget
      ? currentSavings
      : Math.max(currentSavings, totalSavingsBudget);
  const trackedCurrentCash =
    initialCashFlow + actualIncome - actualCashExpenses - actualSavings - actualCardPayments;
  const reviewCashVariance = numeric(state.currentCashFlow) - trackedCurrentCash;
  const projectedCardCoverage = actualCardSpending - actualCardPayments;
  const projectedCommittedDebts = projectedGroupTotal(state, "debts", timing);
  const projectedHouseholdExpenses = projectedGroupTotal(state, "household", timing);
  const projectedExtraordinaryExpenses = projectedGroupTotal(state, "extraordinary", timing);
  const actualCommittedDebts = actualGroupTotal(state, "debts");
  const actualHouseholdExpenses = actualGroupTotal(state, "household");
  const actualExtraordinaryExpenses = actualGroupTotal(state, "extraordinary");
  const totalControlledActualExpenses = actualCommittedDebts + actualHouseholdExpenses + actualExtraordinaryExpenses;
  const miscellaneousActualRaw =
    initialCashFlow +
    actualIncome -
    currentCashFlow -
    totalControlledActualExpenses -
    currentSavings +
    numeric(state.initialSavings) +
    initialCashFlow +
    safeDivide(miscellaneous, timing.daysInMonth) +
    actualCardSpending;
  const miscellaneousActual = miscellaneousActualRaw;
  const totalActualExpenses = totalControlledActualExpenses + miscellaneousActual;
  const actualAvailableForExpenses = totalActualExpenses;
  const projectedControlledExpenses =
    projectedCommittedDebts + projectedHouseholdExpenses + projectedExtraordinaryExpenses;
  const projectedMiscellaneousRunRate =
    timing.remainingDays === 0 ? miscellaneousActual : miscellaneousActual + safeDivide(miscellaneous, timing.daysInMonth) * timing.remainingDays;
  const miscellaneousProjected = projectedMiscellaneousRunRate;
  const expectedEndCashFlow =
    initialCashFlow +
    projectedIncome -
    projectedControlledExpenses -
    miscellaneousProjected +
    totalSavingsBudget -
    projectedSavings +
    projectedCardCoverage -
    (savingsDepositPassed ? 0 : budgetedSavings);
  const projectedAvailableForExpenses =
    initialCashFlow +
    projectedIncome -
    projectedSavings +
    totalSavingsBudget -
    expectedEndCashFlow +
    projectedCardCoverage +
    creditCardOverdraft -
    (savingsDepositPassed ? 0 : budgetedSavings);
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
    actualAvailableForExpenses,
    projectedAvailableForExpenses,
    totalExpensesBudget,
    totalActualExpenses,
    totalProjectedExpenses,
    committedDebts,
    householdExpenses,
    extraordinaryExpenses,
    miscellaneousRaw,
    miscellaneous,
    miscellaneousActualRaw,
    miscellaneousActual,
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
    actualBalanceDifference: actualAvailableForExpenses - totalActualExpenses,
    projectedBalanceDifference: projectedAvailableForExpenses - totalProjectedExpenses,
    debtToIncome,
    healthScore,
    alerts: buildAlerts(state, miscellaneousRaw, miscellaneousActualRaw, miscellaneousProjected, projectedSavings, today),
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

export function projectionRows(state, today = new Date()) {
  const timing = monthTiming(state.month, effectiveProjectionDate(state, today));
  const groups = [
    { label: "Committed Debts", group: "debts" },
    { label: "Household Expenses", group: "household" },
    { label: "Extraordinary Expenses", group: "extraordinary" },
  ];
  return groups.map(({ label, group, details }) => {
    const lines =
      details ||
      state.expenses
        .filter((line) => line.group === group)
        .map((line) => ({ id: line.id, label: line.concept, budget: numeric(line.amount), dueDay: numeric(line.dueDay) }));
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
      projected: lines.reduce((total, line) => total + projectedLineAmount(line.budget, paidForConcept(state, line.id), line.dueDay, timing), 0),
      remaining: Math.max(0, budget - actual),
      paid: budget ? actual / budget : 0,
      evaluation: lowerIsBetter(actual, budget),
      details: lines.map((line) => projectionDetail(state, line, false, timing)),
    };
  });
}

export function projectionAnalysisModel(state, today = new Date()) {
  const projection = calculateProjection(state, today);
  const savingsTarget = numeric(state.initialSavings) + numeric(state.budgetedSavings);
  const cardPayments = paidForConcept(state, "cards");
  const cardExpenses = state.transactions
    .filter((tx) => tx.type === "expense" && tx.paymentMethod === "creditCard" && tx.conceptId !== "cards")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const cardDifference = cardPayments - cardExpenses;
  const paymentTiming = paymentTimingSummary(state, today);
  const expenseRows = projectionRows(state, today);
  return {
    projection,
    availableIncomeRows: availableIncomeRows(state, projection),
    expenseTotalRow: {
      label: "Total Expenses",
      budget: projection.totalExpensesBudget,
      actual: projection.totalActualExpenses,
      projected: projection.totalProjectedExpenses,
      remaining: Math.max(0, projection.totalExpensesBudget - projection.totalActualExpenses),
      paid: projection.totalExpensesBudget ? projection.totalActualExpenses / projection.totalExpensesBudget : 0,
      evaluation: lowerIsBetter(projection.totalProjectedExpenses, projection.totalExpensesBudget),
    },
    rows: expenseRows,
    budgetBalanceDifference: projection.budgetBalanceDifference,
    miscellaneousRow: {
      label: "Miscellaneous",
      budget: projection.miscellaneous,
      actual: projection.miscellaneousActual,
      projected: projection.miscellaneousProjected,
      remaining: Math.max(0, projection.miscellaneous),
      paid: projection.miscellaneous ? projection.miscellaneousActual / projection.miscellaneous : 0,
      evaluation:
        projection.miscellaneousActualRaw < 0 || projection.miscellaneousProjected < 0
          ? status("problem")
          : lowerIsBetter(projection.miscellaneousProjected, projection.miscellaneous),
    },
    creditCardRow: {
      label: "Credit Cards",
      payments: cardPayments,
      expenses: cardExpenses,
      difference: cardDifference,
      evaluation: cardDifference < 0 ? status("problem") : status("good"),
    },
    paymentTiming,
  };
}

function availableIncomeRows(state, projection) {
  const netIncomeActual = state.transactions
    .filter((tx) => tx.type === "income" && tx.conceptId === "net-income")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const otherIncomeActual = state.transactions
    .filter((tx) => tx.type === "income" && tx.conceptId === "other-deposits")
    .reduce((total, tx) => total + numeric(tx.amount), 0);
  const totalSavings = numeric(state.initialSavings) + numeric(state.budgetedSavings);
  return [
    incomeProjectionRow("Available Income", projection.budgetAvailableForExpenses, projection.projectedAvailableForExpenses, projection.actualAvailableForExpenses),
    incomeProjectionRow("Cash Flow Initial", numeric(state.initialCashFlow), numeric(state.initialCashFlow), numeric(state.initialCashFlow)),
    incomeProjectionRow("Salary Net Income", numeric(state.regularIncome), Math.max(numeric(state.regularIncome), netIncomeActual), netIncomeActual),
    incomeProjectionRow("Other Income", numeric(state.irregularIncome), Math.max(numeric(state.irregularIncome), otherIncomeActual), otherIncomeActual),
    incomeProjectionRow("Total Savings", totalSavings, projection.projectedSavings, numeric(state.currentSavings)),
    incomeProjectionRow("Cash Flow Budget", numeric(state.desiredFinalCashFlow), projection.expectedEndCashFlow, numeric(state.currentCashFlow)),
  ];
}

function incomeProjectionRow(label, budget, projected, actual = projected) {
  return {
    label,
    budget,
    actual,
    projected,
    remaining: Math.max(0, budget - actual),
    paid: budget ? actual / budget : 0,
    evaluation: higherIsBetter(projected, budget),
  };
}

export function smartModel(state) {
  const projection = calculateProjection(state);
  const referenceModel = [
    { ref: "0", group: "0.- Savings", concept: "Savings", balanced: 0.1, budget: numeric(state.budgetedSavings), projected: projection.projectedSavings - numeric(state.initialSavings) },
    { ref: "1", group: "1.- Committed Debts", concept: "Mortgage Payment or Home Rent", balanced: 0.15 },
    { ref: "2", group: "1.- Committed Debts", concept: "Credit Cards", balanced: 0.06 },
    { ref: "3", group: "1.- Committed Debts", concept: "Auto, Personal, Loans, Commercial Credit and Other", balanced: 0.06 },
    { ref: "4", group: "2.- Overheads", concept: "Food and Regular Home Purchases", balanced: 0.16 },
    { ref: "5", group: "2.- Overheads", concept: "General Home Services", balanced: 0.09 },
    { ref: "6", group: "2.- Overheads", concept: "Communications, Internet, Telephones and Subscriptions", balanced: 0.07 },
    { ref: "7", group: "2.- Overheads", concept: "Auto Gas Transportation and Similar", balanced: 0.05 },
    { ref: "8", group: "2.- Overheads", concept: "Personal Expenses and Various", balanced: 0.02 },
    { ref: "9", group: "2.- Overheads", concept: "Education General Expense and Fees", balanced: 0.02 },
    { ref: "10", group: "2.- Overheads", concept: "Health, Medicines, Fees and Similar", balanced: 0.03 },
    { ref: "11", group: "2.- Overheads", concept: "Fun, Entertainment, Restaurant and Other", balanced: 0.02 },
    { ref: "12", group: "2.- Overheads", concept: "Other Various Expenses", balanced: 0.01 },
    { ref: "13", group: "3.- Unforeseen Forecasts", concept: "Provision for Unforeseen or Scheduled Expense", balanced: 0.07 },
    { ref: "14", group: "4.- Miscellaneous Expenses", concept: "Miscellaneous no Register Expenses", balanced: 0.09, budget: projection.miscellaneous, projected: projection.miscellaneousProjected },
  ];
  const rows = referenceModel.map((row) => {
    const budget = row.budget ?? sumReference(state, row.ref, "budget");
    const projected = row.projected ?? sumReference(state, row.ref, "projected");
    return { ...row, budget, projected };
  });
  const budgetTotal = rows.reduce((total, row) => total + Math.max(0, numeric(row.budget)), 0);
  const projectedTotal = rows.reduce((total, row) => total + Math.max(0, numeric(row.projected)), 0);
  return rows.map((row) => {
    const current = budgetTotal ? Math.max(0, numeric(row.budget)) / budgetTotal : 0;
    const projected = projectedTotal ? Math.max(0, numeric(row.projected)) / projectedTotal : 0;
    return {
      ...row,
      current,
      projectedPercent: projected,
      currentVariance: current - row.balanced,
      projectedVariance: projected - row.balanced,
    };
  });
}

function sumReference(state, ref, mode) {
  return state.expenses
    .filter((line) => (line.reference || "") === ref)
    .reduce((total, line) => {
      const budget = numeric(line.amount);
      const actual = paidForConcept(state, line.id);
      return total + (mode === "projected" ? Math.max(budget, actual) : budget);
    }, 0);
}

function paymentTimingSummary(state, today) {
  const timing = monthTiming(state.month, effectiveProjectionDate(state, today));
  const nextDays = clamp(Math.round(numeric(state.projectionNextDays)), 0, timing.daysInMonth);
  const futureDay = Math.min(timing.daysInMonth, timing.currentDay + nextDays);
  const rows = state.expenses.map((line) => {
    const budget = numeric(line.amount);
    const paid = paidForConcept(state, line.id);
    const unpaid = Math.max(0, budget - paid);
    const dueDay = Math.round(numeric(line.dueDay));
    return { dueDay, unpaid };
  });
  const overdueAmount = rows
    .filter((row) => row.dueDay > 0 && row.dueDay < timing.currentDay)
    .reduce((total, row) => total + row.unpaid, 0);
  const futureCommittedAmount = rows
    .filter((row) => row.dueDay > 0 && row.dueDay >= timing.currentDay && row.dueDay <= futureDay)
    .reduce((total, row) => total + row.unpaid, 0);
  return {
    nextDays,
    overdueAmount,
    futureCommittedAmount,
    futureDate: formatMonthDay(timing.year, timing.monthIndex, futureDay),
  };
}

function monthTiming(month, today) {
  const selected = new Date(`${month}-01T12:00:00`);
  const reference = Number.isNaN(selected.getTime()) ? today : selected;
  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sameMonth = year === today.getFullYear() && monthIndex === today.getMonth();
  const currentDay = sameMonth ? Math.min(today.getDate(), daysInMonth) : today > reference ? daysInMonth : 1;
  return { currentDay, daysInMonth, remainingDays: Math.max(0, daysInMonth - currentDay), year, monthIndex };
}

function effectiveProjectionDate(state, fallback) {
  const lastUpdate = new Date(`${state.lastActualUpdate || ""}T12:00:00`);
  return Number.isNaN(lastUpdate.getTime()) ? fallback : lastUpdate;
}

function formatMonthDay(year, monthIndex, day) {
  return new Date(year, monthIndex, day).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function projectionDetail(state, line, income, timing) {
  const actual = income
    ? state.transactions
        .filter((tx) => tx.type === "income" && tx.conceptId === line.id)
        .reduce((total, tx) => total + numeric(tx.amount), 0)
    : paidForConcept(state, line.id);
  const paid = line.budget ? actual / line.budget : 0;
  return {
    label: line.label,
    budget: line.budget,
    actual,
    projected: income ? Math.max(line.budget, actual) : projectedLineAmount(line.budget, actual, line.dueDay, timing),
    remaining: Math.max(0, line.budget - actual),
    paid,
    dueDate: income ? "" : formatMonthDay(timing.year, timing.monthIndex, Math.max(1, Math.min(timing.daysInMonth, Math.round(numeric(line.dueDay)) || 1))),
    dueStatus: income ? "none" : paymentDueStatus(paid, line.dueDay, timing),
    evaluation: income ? higherIsBetter(actual, line.budget) : lowerIsBetter(actual, line.budget),
  };
}

function paymentDueStatus(paid, dueDay, timing) {
  if (paid >= 1) return "paid";
  const daysUntilDue = Math.round(numeric(dueDay)) - timing.currentDay;
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue < 5) return "soon";
  return "future";
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

function projectedGroupTotal(state, group, timing) {
  const lines = state.expenses.filter((line) => line.group === group);
  return lines.reduce((total, line) => {
    const budget = numeric(line.amount);
    return total + projectedLineAmount(budget, paidForConcept(state, line.id), line.dueDay, timing);
  }, 0);
}

function projectedLineAmount(budget, actual) {
  if (actual > budget) return actual;
  if (actual > budget * 0.85) return actual;
  return budget;
}

function safeDivide(value, divisor) {
  return divisor ? value / divisor : 0;
}

function actualGroupTotal(state, group) {
  return state.expenses
    .filter((line) => line.group === group)
    .reduce((total, line) => total + paidForConcept(state, line.id), 0);
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

function buildAlerts(state, miscellaneousRaw, miscellaneousActualRaw, miscellaneousProjected, projectedSavings, today) {
  const alerts = [];
  if (miscellaneousRaw < 0) alerts.push("Budget deficit: miscellaneous is negative before adjustment.");
  if (miscellaneousActualRaw < 0) {
    alerts.push("Actual miscellaneous is negative. Review missing transactions or update Cash Flow and Savings balances before making decisions.");
  }
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
