export const defaultState = {
  dataVersion: 6,
  dataNotice: "",
  termsAcceptedVersion: "",
  termsAcceptedAt: "",
  historySnapshots: [],
  month: new Date().toISOString().slice(0, 7),
  language: "en",
  regularIncome: 6500,
  irregularIncome: 300,
  estimatedTaxPercent: 18,
  initialCashFlow: 1200,
  currentCashFlow: 1850,
  lastActualUpdate: "",
  desiredFinalCashFlow: 900,
  initialSavings: 4200,
  currentSavings: 4200,
  budgetedSavings: 700,
  savingsDepositDay: 15,
  plannedCreditCardSpending: 900,
  projectionNextDays: 5,
  smartPieMode: 1,
  crisisMode: false,
  transactionFilters: {
    dateFrom: "",
    dateTo: "",
    type: "all",
    conceptId: "all",
    paymentMethod: "all",
  },
  expenses: [
    { id: "housing", concept: "Home Rent or Pay Mortgage", amount: 1850, dueDay: 1, group: "debts", reference: "1" },
    { id: "cards", concept: "Credit Cards All Payments", amount: 650, dueDay: 12, group: "debts", reference: "2" },
    { id: "other-debts", concept: "Other Debts", amount: 0, dueDay: 15, group: "debts", reference: "3" },
    { id: "utilities", concept: "Utilities and services", amount: 420, dueDay: 10, group: "household", reference: "5" },
    { id: "groceries", concept: "Groceries", amount: 850, dueDay: 20, group: "household", reference: "4" },
    { id: "car", concept: "Car maintenance provision", amount: 250, dueDay: 25, group: "extraordinary", reference: "13" },
  ],
  transactions: [],
};

const key = "smart-budget-app-state";
const DATA_VERSION = defaultState.dataVersion;

export function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    const saved = { ...structuredClone(defaultState), ...stored };
    const needsMigration = numericVersion(stored.dataVersion) < DATA_VERSION;
    saved.dataVersion = DATA_VERSION;
    saved.transactionFilters = {
      ...defaultState.transactionFilters,
      ...(saved.transactionFilters || {}),
    };
    saved.transactions = Array.isArray(saved.transactions) ? saved.transactions.map(normalizedTransaction) : [];
    saved.historySnapshots = Array.isArray(saved.historySnapshots) ? saved.historySnapshots.map(normalizedHistorySnapshot) : [];
    saved.expenses = saved.expenses.map((line) => ({
      ...line,
      concept:
        line.id === "housing" && line.concept === "Housing"
          ? "Home Rent or Pay Mortgage"
          : line.id === "cards" && line.concept === "Credit card payments"
            ? "Credit Cards All Payments"
            : line.concept,
      reference: normalizedReference(line),
    }));
    if (!saved.expenses.some((line) => line.group === "debts" && line.reference === "3")) {
      saved.expenses.splice(2, 0, structuredClone(defaultState.expenses[2]));
    }
    saved.currentCashFlow = normalizedNumber(saved.currentCashFlow, defaultState.currentCashFlow);
    saved.currentSavings = normalizedNumber(saved.currentSavings, defaultState.currentSavings);
    if (needsMigration) {
      saved.dataNotice =
        "Your saved browser data was updated to the latest calculation model. Review actual balances and transactions before using projections.";
      saveState(saved);
    }
    return saved;
  } catch {
    return structuredClone(defaultState);
  }
}

function numericVersion(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedTransaction(tx) {
  return {
    id: tx.id || crypto.randomUUID(),
    date: tx.date || "",
    conceptId: tx.conceptId || "",
    amount: normalizedNumber(tx.amount),
    type: tx.type || "expense",
    paymentMethod: tx.paymentMethod || "cash",
    comment: tx.comment || "",
  };
}

function normalizedHistorySnapshot(snapshot) {
  return {
    id: snapshot.id || crypto.randomUUID(),
    month: snapshot.month || "",
    year: normalizedNumber(snapshot.year),
    savedAt: snapshot.savedAt || "",
    availableBudget: normalizedNumber(snapshot.availableBudget),
    availableActual: normalizedNumber(snapshot.availableActual),
    availableProjected: normalizedNumber(snapshot.availableProjected),
    expensesBudget: normalizedNumber(snapshot.expensesBudget),
    expensesActual: normalizedNumber(snapshot.expensesActual),
    expensesProjected: normalizedNumber(snapshot.expensesProjected),
    cashFlowInitial: normalizedNumber(snapshot.cashFlowInitial),
    cashFlowActual: normalizedNumber(snapshot.cashFlowActual),
    cashFlowProjected: normalizedNumber(snapshot.cashFlowProjected),
    savingsBudget: normalizedNumber(snapshot.savingsBudget),
    savingsActual: normalizedNumber(snapshot.savingsActual),
    savingsProjected: normalizedNumber(snapshot.savingsProjected),
    creditCardPayments: normalizedNumber(snapshot.creditCardPayments),
    creditCardExpenses: normalizedNumber(snapshot.creditCardExpenses),
    creditCardDifference: normalizedNumber(snapshot.creditCardDifference),
    miscellaneousActual: normalizedNumber(snapshot.miscellaneousActual),
    balanceDifference: normalizedNumber(snapshot.balanceDifference),
    evaluation: snapshot.evaluation || "",
  };
}

function normalizedReference(line) {
  if (line.group === "debts") {
    if (line.id === "housing") return "1";
    if (line.id === "cards") return "2";
    return "3";
  }
  if (line.group === "extraordinary") return "13";
  if (line.reference === "2HOEXP" || !["4", "5", "6", "7", "8", "9", "10", "11", "12"].includes(String(line.reference))) {
    return "4";
  }
  return String(line.reference);
}

export function saveState(state) {
  localStorage.setItem(key, JSON.stringify({ ...state, dataVersion: DATA_VERSION }));
}

export function resetState() {
  localStorage.removeItem(key);
  return structuredClone(defaultState);
}

export function reconcileState(state) {
  const reconciled = {
    ...structuredClone(defaultState),
    ...state,
    dataVersion: DATA_VERSION,
    dataNotice: "",
    transactionFilters: {
      ...defaultState.transactionFilters,
      ...(state.transactionFilters || {}),
    },
  };
  reconciled.transactions = Array.isArray(state.transactions) ? state.transactions.map(normalizedTransaction) : [];
  reconciled.historySnapshots = Array.isArray(state.historySnapshots) ? state.historySnapshots.map(normalizedHistorySnapshot) : [];
  reconciled.expenses = Array.isArray(state.expenses)
    ? state.expenses.map((line) => ({
        ...line,
        amount: normalizedNumber(line.amount),
        dueDay: normalizedNumber(line.dueDay, 15),
        reference: normalizedReference(line),
      }))
    : structuredClone(defaultState.expenses);
  reconciled.currentCashFlow = normalizedNumber(reconciled.currentCashFlow, defaultState.currentCashFlow);
  reconciled.currentSavings = normalizedNumber(reconciled.currentSavings, defaultState.currentSavings);
  return reconciled;
}

export function clearActualMonthState(state) {
  return {
    ...reconcileState(state),
    transactions: [],
    currentCashFlow: normalizedNumber(state.initialCashFlow, defaultState.initialCashFlow),
    currentSavings: normalizedNumber(state.initialSavings, defaultState.initialSavings),
    lastActualUpdate: "",
    dataNotice: "Actual month data was reset. Budget values remain; enter current Cash Flow, current Savings, income deposits, expenses, and credit card activity again.",
    transactionFilters: structuredClone(defaultState.transactionFilters),
  };
}
