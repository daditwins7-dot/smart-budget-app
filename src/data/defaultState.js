export const defaultState = {
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

export function loadState() {
  try {
    const saved = { ...defaultState, ...JSON.parse(localStorage.getItem(key) || "{}") };
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
    return saved;
  } catch {
    return structuredClone(defaultState);
  }
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
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(key);
  return structuredClone(defaultState);
}
