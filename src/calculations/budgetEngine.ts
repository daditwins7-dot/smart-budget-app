import type { BudgetProjection, BudgetState, ExpenseGroup } from "../types";

export declare function money(value: number): string;
export declare function pct(value: number): string;
export declare function sum(lines: BudgetState["expenses"], group?: ExpenseGroup): number;
export declare function calculateProjection(state: BudgetState, today?: Date): BudgetProjection;
export declare function dashboardModel(state: BudgetState, today?: Date): {
  projection: BudgetProjection;
  period: { monthLabel: string; dateLabel: string; remainingDays: number };
  creditCapacity: number;
  dpi: number;
  indicatorPosition: number;
  financialStatus: { key: "good" | "watch" | "problem"; label: string };
  conceptRows: Array<{
    label: string;
    budget: Array<{ label: string; value: number }>;
    projected: Array<{ label: string; value: number }>;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  }>;
  expenseStructureRows: Array<{
    label: string;
    budget: number;
    projected: number;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  }>;
  creditCardStructure: {
    label: string;
    budget: number;
    overdraft: number;
    total: number;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  };
};
export declare function projectionRows(state: BudgetState): Array<{
  label: string;
  budget: number;
  actual: number;
  projected: number;
  remaining: number;
  paid: number;
}>;
export declare function projectionAnalysisModel(state: BudgetState, today?: Date): {
  projection: BudgetProjection;
  availableIncomeRows: Array<{
    label: string;
    budget: number;
    actual: number;
    projected: number;
    remaining: number;
    paid: number;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  }>;
  expenseTotalRow: {
    label: string;
    budget: number;
    actual: number;
    projected: number;
    remaining: number;
    paid: number;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  };
  rows: ReturnType<typeof projectionRows>;
  budgetBalanceDifference: number;
  miscellaneousRow: {
    label: string;
    budget: number;
    actual: number;
    projected: number;
    remaining: number;
    paid: number;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  };
  creditCardRow: {
    label: string;
    payments: number;
    expenses: number;
    difference: number;
    evaluation: { key: "good" | "watch" | "problem"; label: string };
  };
  paymentTiming: {
    nextDays: number;
    overdueAmount: number;
    futureCommittedAmount: number;
    futureDate: string;
  };
};
