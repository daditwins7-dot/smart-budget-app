export const defaultState = {
  month: new Date().toISOString().slice(0, 7),
  language: "en",
  regularIncome: 6500,
  irregularIncome: 300,
  estimatedTaxPercent: 18,
  initialCashFlow: 1200,
  currentCashFlow: 1850,
  desiredFinalCashFlow: 900,
  initialSavings: 4200,
  currentSavings: 4200,
  budgetedSavings: 700,
  savingsDepositDay: 15,
  plannedCreditCardSpending: 900,
  crisisMode: false,
  expenses: [
    { id: "housing", concept: "Housing", amount: 1850, dueDay: 1, group: "debts", reference: "1DEBTS" },
    { id: "cards", concept: "Credit card payments", amount: 650, dueDay: 12, group: "debts", reference: "1DEBTS" },
    { id: "utilities", concept: "Utilities and services", amount: 420, dueDay: 10, group: "household", reference: "2HOEXP" },
    { id: "groceries", concept: "Groceries", amount: 850, dueDay: 20, group: "household", reference: "2HOEXP" },
    { id: "car", concept: "Car maintenance provision", amount: 250, dueDay: 25, group: "extraordinary", reference: "3EXTEX" },
  ],
  transactions: [],
};

const key = "smart-budget-app-state";

export function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(key);
  return structuredClone(defaultState);
}
