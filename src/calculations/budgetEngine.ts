import type { BudgetProjection, BudgetState, ExpenseGroup } from "../types";

export declare function money(value: number): string;
export declare function pct(value: number): string;
export declare function sum(lines: BudgetState["expenses"], group?: ExpenseGroup): number;
export declare function calculateProjection(state: BudgetState, today?: Date): BudgetProjection;
export declare function projectionRows(state: BudgetState): Array<{
  label: string;
  budget: number;
  actual: number;
  projected: number;
  remaining: number;
  paid: number;
}>;
