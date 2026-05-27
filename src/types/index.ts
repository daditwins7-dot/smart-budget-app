export type Language = "en" | "es";

export type ExpenseGroup = "debts" | "household" | "extraordinary";

export type TransactionType =
  | "income"
  | "expense"
  | "saving"
  | "creditCardPayment";

export type PaymentMethod = "cash" | "creditCard";

export interface BudgetLine {
  id: string;
  concept: string;
  amount: number;
  dueDay: number;
  group: ExpenseGroup;
  reference?: string;
}

export interface Transaction {
  id: string;
  date: string;
  conceptId: string;
  amount: number;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  comment?: string;
}

export interface BudgetState {
  month: string;
  language: Language;
  regularIncome: number;
  irregularIncome: number;
  estimatedTaxPercent: number;
  initialCashFlow: number;
  currentCashFlow: number;
  desiredFinalCashFlow: number;
  initialSavings: number;
  currentSavings: number;
  budgetedSavings: number;
  savingsDepositDay: number;
  plannedCreditCardSpending: number;
  crisisMode: boolean;
  expenses: BudgetLine[];
  transactions: Transaction[];
}

export interface BudgetProjection {
  resources: number;
  totalIncomeBudget: number;
  totalProjectedIncome: number;
  budgetAvailableForExpenses: number;
  projectedAvailableForExpenses: number;
  totalExpensesBudget: number;
  totalProjectedExpenses: number;
  committedDebts: number;
  householdExpenses: number;
  extraordinaryExpenses: number;
  miscellaneousRaw: number;
  miscellaneous: number;
  miscellaneousProjected: number;
  expectedEndCashFlow: number;
  projectedSavings: number;
  creditCardPlanned: number;
  creditCardActual: number;
  creditCardPaymentsActual: number;
  projectedCardCoverage: number;
  reviewCashVariance: number;
  budgetBalanceDifference: number;
  projectedBalanceDifference: number;
  debtToIncome: number;
  healthScore: number;
  alerts: string[];
}

export type EvaluationStatus = "good" | "watch" | "problem";
