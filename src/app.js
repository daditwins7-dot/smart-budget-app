import { dashboardModel, money, pct, projectionAnalysisModel, smartModel } from "./calculations/budgetEngine.js";
import { loadState, resetState, saveState } from "./data/defaultState.js";
import { copy } from "./i18n/index.js";

let state = loadState();
const initialPage = new URLSearchParams(window.location.search).get("page");
let page = ["dashboard", "budget", "transactions", "projections", "smartModel", "evaluation", "settings"].includes(initialPage)
  ? initialPage
  : "dashboard";
const app = document.querySelector("#app");
const comparativeReferences = {
  household: [
    ["4", "Food and Regular Home Purchases"],
    ["5", "General Home Services"],
    ["6", "Communications, Internet, Telephones and Subscriptions"],
    ["7", "Auto Gas Transportation and Similar"],
    ["8", "Personal Expenses and Various"],
    ["9", "Education General Expense and Fees"],
    ["10", "Health, Medicines, Fees and Similar"],
    ["11", "Fun, Entertainment, Restaurant and Other"],
    ["12", "Other Various Expenses"],
  ],
  extraordinary: [["13", "Provision for Unforeseen or Scheduled Expenses"]],
};

function render() {
  const t = copy[state.language] || copy.en;
  const currentPageTitle = t[page] || copy.en[page] || "Smart Model";
  const dashboardData = dashboardModel(state);
  const projection = dashboardData.projection;
  app.innerHTML = `
    <aside class="shell-nav">
      <div class="brand"><span>SMART</span><strong>BUDGET</strong></div>
      ${navButton("dashboard", t.dashboard)}
      ${navButton("budget", t.budget)}
      ${navButton("transactions", t.transactions)}
      ${navButton("projections", t.projections)}
      ${navButton("smartModel", t.smartModel || "Smart Model")}
      ${navButton("evaluation", t.evaluation)}
      ${navButton("settings", t.settings)}
    </aside>
    <main class="workspace ${page === "dashboard" ? "dashboard-workspace" : ""}">
      ${page !== "dashboard" && page !== "budget" ? `<header class="topbar">
        <div>
          <p class="eyebrow">Monthly predictive planning</p>
          <h1>${currentPageTitle}</h1>
        </div>
        <div class="month-chip">${state.month}</div>
      </header>` : ""}
      ${page !== "dashboard" && page !== "budget" && projection.alerts.length ? `<section class="alerts">${projection.alerts.map((a) => `<p>${a}</p>`).join("")}</section>` : ""}
      ${page === "dashboard" ? dashboard(dashboardData) : ""}
      ${page === "budget" ? budgetSetup(projection) : ""}
      ${page === "transactions" ? transactions() : ""}
      ${page === "projections" ? projections() : ""}
      ${page === "smartModel" ? smartModelPage() : ""}
      ${page === "evaluation" ? evaluation(projection) : ""}
      ${page === "settings" ? settings() : ""}
    </main>
  `;
  bindEvents();
}

function navButton(id, label) {
  return `<button class="nav-button ${page === id ? "active" : ""}" data-page="${id}">${label}</button>`;
}

function dashboard(model) {
  const p = model.projection;
  return `
    <section class="dashboard-board">
      <header class="dashboard-header">
        <div>
          <p class="board-heading">Dashboard</p>
          <div class="dashboard-brand"><span aria-hidden="true"></span>SMART BUDGET</div>
        </div>
        <dl class="period-data">
          <div><dt>Month</dt><dd>${model.period.monthLabel}</dd></div>
          <div><dt>Date</dt><dd>${model.period.dateLabel}</dd></div>
          <div><dt>Remain Days</dt><dd>${model.period.remainingDays}</dd></div>
        </dl>
      </header>
      <div class="dashboard-table-wrap">
        <table class="dashboard-summary">
          <thead><tr><th>Concept</th><th>Budget</th><th>Projected</th><th>Evaluation</th></tr></thead>
          <tbody>
            ${model.conceptRows.map(dashboardRow).join("")}
            <tr class="table-section-row"><td colspan="4">Total Expense Structure</td></tr>
            ${model.expenseStructureRows.map(expenseStructureRow).join("")}
            ${creditCardStructureRow(model.creditCardStructure)}
          </tbody>
        </table>
      </div>
      <section class="financial-status">
        <h2><span aria-hidden="true"></span> Financial Status</h2>
        <div class="status-scale" aria-label="Financial health indicator">
          <i class="good"></i><i class="watch"></i><i class="problem"></i>
          <b style="left:${model.indicatorPosition}%"></b>
        </div>
        <div class="financial-values">
          <p>DPI: <strong>${Math.round(model.dpi)}%</strong></p>
          <p>Credit Capacity: <strong>${money(model.creditCapacity)}</strong></p>
          ${evaluationResult(model.financialStatus)}
        </div>
      </section>
      ${p.alerts.length ? `<section class="dashboard-alerts">${p.alerts.map((alert) => `<p>${alert}</p>`).join("")}</section>` : ""}
      <footer class="signal-guide">
        <h2>Signals</h2>
        <p>${signalDot("problem")} Problem</p>
        <p>${signalDot("watch")} Watch</p>
        <p>${signalDot("good")} On track</p>
      </footer>
    </section>
  `;
}

function dashboardRow(row) {
  return `<tr class="status-${row.evaluation.key}">
    <td class="concept-name">${row.label}</td>
    <td>${rowValues(row.budget)}</td>
    <td>${rowValues(row.projected)}</td>
    <td>${evaluationResult(row.evaluation)}</td>
  </tr>`;
}

function expenseStructureRow(row) {
  return `<tr class="detail-row status-${row.evaluation.key}">
    <td><span class="detail-name">${row.label}</span></td>
    <td>${money(row.budget)}</td>
    <td>${money(row.projected)}</td>
    <td>${evaluationResult(row.evaluation)}</td>
  </tr>`;
}

function creditCardStructureRow(row) {
  return `<tr class="detail-row credit-card-structure status-${row.evaluation.key}">
    <td><span class="detail-name">${row.label}</span></td>
    <td>${rowValues([{ label: "Budget", value: row.budget }])}</td>
    <td>${rowValues([
      { label: "Overdraft", value: row.overdraft },
      { label: "Total", value: row.total },
    ])}</td>
    <td>${evaluationResult(row.evaluation)}</td>
  </tr>`;
}

function rowValues(values) {
  return `<div class="dashboard-values">${values.map((item) => `<span><small>${item.label}</small><strong>${money(item.value)}</strong></span>`).join("")}</div>`;
}

function evaluationResult(evaluation) {
  return `<span class="evaluation ${evaluation.key}">${signalDot(evaluation.key)}${evaluation.label}</span>`;
}

function signalDot(status) {
  return `<i class="signal-dot ${status}" aria-hidden="true"></i>`;
}

function budgetSetup(p) {
  return `
    <section class="budget-sheet">
      <header class="budget-title">
        <div>
          <p class="board-heading">Budget Setup</p>
          <div class="dashboard-brand"><span aria-hidden="true"></span>SMART BUDGET</div>
        </div>
        <input type="month" data-field="month" value="${state.month}" aria-label="Budget month" />
      </header>
      <section class="budget-section">
        <h2>Income</h2>
        <table class="budget-simple">
          <thead><tr><th>Concept</th><th>Amount</th><th>% Tax</th></tr></thead>
          <tbody>
            <tr class="budget-total-row"><td>Available Income</td><td>${money(p.budgetAvailableForExpenses)}</td><td class="calculated-mark">Calculated</td></tr>
            <tr><td>Salary Net Income</td><td>${inlineNumber("regularIncome")}</td><td>${inlineNumber("estimatedTaxPercent", "percent")}</td></tr>
            <tr><td>Other Income</td><td>${inlineNumber("irregularIncome")}</td><td class="calculated-mark">---</td></tr>
          </tbody>
        </table>
      </section>
      <section class="budget-section">
        <h2>Balances</h2>
        <table class="budget-simple">
          <thead><tr><th>Concept</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            <tr><td>Cash Flow Initial</td><td>${inlineNumber("initialCashFlow")}</td><td></td></tr>
            <tr><td>Cash Flow Budget</td><td>${inlineNumber("desiredFinalCashFlow")}</td><td></td></tr>
            <tr><td>Savings Initial</td><td>${inlineNumber("initialSavings")}</td><td></td></tr>
          </tbody>
        </table>
      </section>
      <section class="budget-section total-expenses-section">
        <h2>Expenses</h2>
        <table class="budget-simple">
          <thead><tr><th>Concept</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            <tr class="budget-total-row"><td>Total Expenses</td><td>${money(p.totalExpensesBudget)}</td><td class="calculated-mark">Calculated</td></tr>
          </tbody>
        </table>
      </section>
      ${budgetExpenseSection("Committed Debts", "debts", "Fixed references: Home Rent or Mortgage = 1, Credit Cards = 2, Other Debts = 3.")}
      ${budgetExpenseSection("Household Expenses", "household", "Choose the comparative budget group that describes each monthly expense.")}
      ${budgetExpenseSection("Extraordinary Expenses", "extraordinary", "Unforeseen or scheduled non-monthly expenses use comparative group 13.")}
      <section class="budget-section calculated-section">
        <div class="calculated-heading">
          <h2>Calculated Miscellaneous Balance</h2>
          <p>Remaining after payments, available for expenses, savings and miscellaneous.</p>
        </div>
        <table class="budget-simple misc-table">
          <thead><tr><th>Concept</th><th>Amount</th><th>Ref</th></tr></thead>
          <tbody><tr><td>Miscellaneous</td><td class="${p.miscellaneous < 0 ? "danger" : "ok"}">${money(p.miscellaneous)}</td><td>14</td></tr></tbody>
        </table>
      </section>
      <section class="budget-section ending-section">
        <table class="budget-simple summary-inputs">
          <thead><tr><th>Concept</th><th>Amount</th><th>Deposit Day</th></tr></thead>
          <tbody>
            <tr><td><strong>Savings</strong> Planned Saving</td><td>${inlineNumber("budgetedSavings")}</td><td>${inlineNumber("savingsDepositDay", "day")}</td></tr>
          </tbody>
        </table>
      </section>
      <section class="budget-section credit-card-budget-section">
        <table class="credit-card-budget">
          <thead><tr><th></th><th>Budget</th><th>Overdraft</th><th>Total</th></tr></thead>
          <tbody>
            <tr>
              <td><span class="detail-name">Credit Cards</span></td>
              <td>${inlineNumber("plannedCreditCardSpending")}</td>
              <td class="${p.creditCardOverdraft > 0 ? "danger" : "ok"}">${money(p.creditCardOverdraft)}</td>
              <td class="credit-card-total">${money(p.creditCardTotal)}</td>
            </tr>
          </tbody>
        </table>
        <p class="budget-note">Overdraft is calculated when controlled expenses exceed available income before credit cards.</p>
      </section>
    </section>
  `;
}

function budgetExpenseSection(title, group, note) {
  return `
    <section class="budget-section expense-setup">
      <div class="budget-section-head">
        <h2>${title}</h2>
        <button class="secondary add-concept" data-add-group="${group}" type="button">${group === "debts" ? "+ Add Other Debt" : "+ Add concept"}</button>
      </div>
      <div class="table-wrap">${budgetExpenseTable(group)}</div>
      <p class="budget-note">${note}</p>
    </section>
  `;
}

function budgetExpenseTable(group) {
  const rows = state.expenses
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.group === group);
  return `
    <table class="budget-expenses ${group === "debts" ? "fixed-refs" : "selectable-refs"}">
      <thead><tr><th>Concept</th><th>Ref</th><th>Amount</th><th>Due Day</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          ({ line, index }) => `<tr>
            <td><input data-line="${index}" data-prop="concept" value="${line.concept}" /></td>
            <td>${referenceControl(line, index, group)}</td>
            <td><input type="number" data-line="${index}" data-prop="amount" value="${line.amount}" /></td>
            <td><input type="number" min="1" max="31" data-line="${index}" data-prop="dueDay" value="${line.dueDay}" /></td>
            <td>${removableExpenseLine(line, group) ? `<button class="icon danger-text" data-remove-line="${index}" title="Remove concept">x</button>` : ""}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>
  `;
}

function removableExpenseLine(line, group) {
  return group !== "debts" || (line.reference === "3" && line.id !== "other-debts");
}

function referenceControl(line, index, group) {
  if (group === "debts") {
    const description = line.reference === "1" ? "Housing" : line.reference === "2" ? "Credit Cards" : "Other Debts";
    return `<span class="fixed-reference" title="${description}" aria-label="${line.reference} - ${description}"><strong>${line.reference}</strong></span>`;
  }
  return `<select class="reference-select" data-line="${index}" data-prop="reference" aria-label="Reference for ${line.concept}">
    ${comparativeReferences[group]
      .map(([value, label]) => `<option value="${value}" data-description="${label}" ${line.reference === value ? "selected" : ""}>${value}</option>`)
      .join("")}
  </select>`;
}

function toggleReferenceDescriptions(select, expanded) {
  Array.from(select.options).forEach((option) => {
    option.textContent = expanded ? `${option.value} - ${option.dataset.description}` : option.value;
  });
}

function inlineNumber(field, type = "amount") {
  const attributes = type === "day" ? `min="1" max="31" step="1"` : `step="0.01"`;
  const suffix = type === "percent" ? `<span class="field-suffix">%</span>` : "";
  return `<span class="inline-field ${type}"><input type="number" ${attributes} data-field="${field}" value="${state[field]}" />${suffix}</span>`;
}

function transactions() {
  const today = localDateValue();
  const lastUpdated = state.lastActualUpdate || "";
  const updateCurrent = lastUpdated === today;
  const visibleTransactions = filteredTransactions();
  const filteredIncomeTotal = visibleTransactions.filter((tx) => tx.type === "income").reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const filteredExpenseTotal = visibleTransactions.filter((tx) => tx.type === "expense").reduce((total, tx) => total + Number(tx.amount || 0), 0);
  return `
    <section class="panel transaction-panel">
      <div class="transaction-heading">
        <h2>Record actual movement</h2>
        <div class="transaction-heading-actions">
          <strong class="income-total">Income: ${money(filteredIncomeTotal)}</strong>
          <strong class="expense-total">Expenses: ${money(filteredExpenseTotal)}</strong>
          <button class="danger-button" type="button" id="clear-month-data">Clear month data</button>
        </div>
      </div>
      <section class="actual-balance-grid">
        <label>Cash Flow
          <input type="number" step="0.01" data-actual-balance="currentCashFlow" value="${state.currentCashFlow}" />
          <small>Current Cash Flow Balance Plus Cash in Hand</small>
        </label>
        <label>Saving
          <input type="number" step="0.01" data-actual-balance="currentSavings" value="${state.currentSavings}" />
          <small>Current Total Savings Account Balance; savings are tracked by balance only.</small>
        </label>
        <label class="last-update ${updateCurrent ? "current" : "stale"}">Last Update Date
          <input type="date" value="${lastUpdated}" readonly aria-label="Last Update Date" />
          <small>${updateCurrent ? "Balances updated today" : "Update balances for today"}</small>
        </label>
      </section>
      <form id="tx-form" class="transaction-form">
        <input name="date" type="date" value="${today}" />
        <select name="type" id="tx-type">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select name="conceptId" id="tx-concept">${transactionConceptOptions("expense")}</select>
        <input name="amount" type="number" step="0.01" placeholder="Amount" required />
        <select name="paymentMethod">
          <option value="cash">Cash</option>
          <option value="creditCard">Credit card</option>
        </select>
        <input name="comment" placeholder="Comment" />
        <button class="primary">Add</button>
      </form>
      <section class="transaction-filter-panel" aria-label="Transaction filters">
        <label>From <input type="date" data-transaction-filter="dateFrom" value="${transactionFilterValue("dateFrom")}" /></label>
        <label>To <input type="date" data-transaction-filter="dateTo" value="${transactionFilterValue("dateTo")}" /></label>
        <label>Type <select data-transaction-filter="type">
          ${transactionFilterOption("all", "All", "type")}
          ${transactionFilterOption("expense", "Expense", "type")}
          ${transactionFilterOption("income", "Income", "type")}
        </select></label>
        <label>Concept <select data-transaction-filter="conceptId">
          ${transactionFilterOption("all", "All concepts", "conceptId")}
          ${transactionConceptFilterOptions()}
        </select></label>
        <label>Payment <select data-transaction-filter="paymentMethod">
          ${transactionFilterOption("all", "All methods", "paymentMethod")}
          ${transactionFilterOption("cash", "Cash", "paymentMethod")}
          ${transactionFilterOption("creditCard", "Credit card", "paymentMethod")}
        </select></label>
        <button class="secondary" type="button" id="clear-tx-filters">Clear filters</button>
      </section>
      <section class="transaction-list-wrap">
        <table class="transaction-list">
          <thead><tr><th>Date</th><th>Type</th><th>Concept</th><th>Amount</th><th>Payment</th><th>Comment</th><th>Action</th></tr></thead>
          <tbody>${transactionRows(visibleTransactions)}</tbody>
        </table>
      </section>
      <p class="transaction-rules">Only budgeted expense concepts are available for tracking. Miscellaneous is calculated by the system and is not recorded here. Payment Method is required for accurate cash flow and credit card balances; select Cash or Credit card correctly for each expense. Credit card expenses and payments are accumulated totals; identify individual card activity in Comment. Savings are not recorded as transactions because bank balances define increases or reductions; when savings are used for payments, reduce the savings balance and increase payments or cash flow as applicable.</p>
    </section>
  `;
}

function localDateValue(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function transactionConceptOptions(type) {
  const options =
    type === "income"
      ? [
          ["net-income", "Net Income"],
          ["other-deposits", "Other Deposits"],
        ]
      : state.expenses.map((line) => [line.id, line.concept]);
  return options.map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
}

function transactionConceptFilterOptions() {
  const options = [
    ["net-income", "Net Income"],
    ["other-deposits", "Other Deposits"],
    ...state.expenses.map((line) => [line.id, line.concept]),
  ];
  return options.map(([id, label]) => transactionFilterOption(id, label, "conceptId")).join("");
}

function transactionFilterValue(field) {
  return state.transactionFilters?.[field] || (["type", "conceptId", "paymentMethod"].includes(field) ? "all" : "");
}

function transactionFilterOption(value, label, field) {
  return `<option value="${value}" ${transactionFilterValue(field) === value ? "selected" : ""}>${label}</option>`;
}

function filteredTransactions() {
  return state.transactions.filter((tx) => {
    const filters = state.transactionFilters || {};
    if (filters.dateFrom && tx.date < filters.dateFrom) return false;
    if (filters.dateTo && tx.date > filters.dateTo) return false;
    if (filters.type && filters.type !== "all" && tx.type !== filters.type) return false;
    if (filters.conceptId && filters.conceptId !== "all" && tx.conceptId !== filters.conceptId) return false;
    if (filters.paymentMethod && filters.paymentMethod !== "all" && tx.paymentMethod !== filters.paymentMethod) return false;
    return true;
  });
}

function showCurrentActualUpdate() {
  const indicator = document.querySelector(".last-update");
  if (!indicator) return;
  indicator.classList.remove("stale");
  indicator.classList.add("current");
  indicator.querySelector("input").value = state.lastActualUpdate;
  indicator.querySelector("small").textContent = "Balances updated today";
}

function projections() {
  const model = projectionAnalysisModel(state);
  return `
    <section class="panel projection-panel">
      <div class="projection-top-grid">
        <div>
          <h2>Available Income</h2>
          <div class="projection-grid projection-grid-header">
            <span>Group</span><span>Budget</span><span>Actual</span><span>Projected</span><span>Remaining</span><span>% Paid</span><span>Evaluation</span>
          </div>
          ${model.availableIncomeRows.map(projectionAvailableIncomeRow).join("")}
        </div>
        ${projectionPaymentTiming(model.paymentTiming)}
      </div>
    </section>
    <section class="panel projection-panel">
      <div class="projection-section-head">
        <div>
          <h2>Expenses</h2>
          <p class="muted projection-note">Expand a budget group to review each tracked concept.</p>
        </div>
        <div class="projection-controls">
          <label class="toggle"><input type="checkbox" data-field="crisisMode" ${state.crisisMode ? "checked" : ""}/> Crisis mode</label>
          <span class="${model.budgetBalanceDifference === 0 ? "ok" : "danger"}">Balance check: ${money(model.budgetBalanceDifference)}</span>
        </div>
      </div>
      <div class="projection-grid projection-grid-header">
        <span>Group</span><span>Budget</span><span>Actual</span><span>Projected</span><span>Remaining</span><span>% Paid</span><span>Evaluation</span>
      </div>
      ${model.rows.map(projectionExpandableRow).join("")}
      ${projectionStandardRow(model.miscellaneousRow)}
    </section>
    <section class="panel projection-panel">
      <h2>Credit Cards</h2>
      <div class="table-wrap">
        <table class="projection-special-table">
          <thead><tr><th>Concept</th><th>Payments</th><th>Expenses</th><th>Difference</th><th>Evaluation</th></tr></thead>
          <tbody>${projectionSpecialRow(model.creditCardRow)}</tbody>
        </table>
      </div>
      <p class="muted projection-note projection-calculated-note">Credit Cards compares recorded payments against expenses paid by credit card.</p>
      <footer class="signal-guide projection-signals">
        <h2>Evaluation</h2>
        <p>${signalDot("problem")} Problem</p>
        <p>${signalDot("watch")} Watch</p>
        <p>${signalDot("good")} On track</p>
      </footer>
    </section>
  `;
}

function projectionAvailableIncomeRow(row) {
  return `<div class="projection-grid projection-available-row status-${row.evaluation.key}">
    <strong>${row.label}</strong><span>${money(row.budget)}</span><span>${money(row.actual)}</span><span>${money(row.projected)}</span><span>${money(row.remaining)}</span><span>${pct(row.paid)}</span><span>${evaluationResult(row.evaluation)}</span>
  </div>`;
}

function projectionPaymentTiming(timing) {
  return `<aside class="payment-timing-card">
    <h2>Payment Timing</h2>
    <div class="payment-timing-row"><span>Overdue Payments</span><strong>${money(timing.overdueAmount)}</strong></div>
    <div class="payment-timing-row future">
      <span>Future Committed Payments</span>
      <div class="payment-timing-fields">
        <label>Next Days <input type="number" min="0" max="31" step="1" data-field="projectionNextDays" value="${timing.nextDays}" /></label>
        <small>Date ${timing.futureDate}</small>
        <strong>${money(timing.futureCommittedAmount)}</strong>
      </div>
    </div>
  </aside>`;
}

function projectionExpandableRow(row) {
  return `<details class="projection-group status-${row.evaluation.key}">
    <summary class="projection-grid">
      <strong>${row.label}</strong><span>${money(row.budget)}</span><span>${money(row.actual)}</span><span>${money(row.projected)}</span><span>${money(row.remaining)}</span><span>${pct(row.paid)}</span><span>${evaluationResult(row.evaluation)}</span>
    </summary>
      <div class="projection-detail-wrap">
        <table class="projection-detail-table">
        <thead><tr><th>Concept</th><th>Budget</th><th>Actual</th><th>Projected</th><th>Remaining</th><th>% Paid</th><th>Due Date</th><th>Evaluation</th></tr></thead>
        <tbody>${row.details.map(projectionDetailRow).join("")}</tbody>
      </table>
    </div>
  </details>`;
}

function projectionStandardRow(row) {
  return `<div class="projection-grid projection-standard-row status-${row.evaluation.key}">
    <strong>${row.label}</strong><span>${money(row.budget)}</span><span>${money(row.actual)}</span><span>${money(row.projected)}</span><span>${money(row.remaining)}</span><span>${pct(row.paid)}</span><span>${evaluationResult(row.evaluation)}</span>
  </div>`;
}

function projectionDetailRow(row) {
  const dueDate = row.dueDate ? `<span class="due-date due-${row.dueStatus}">${row.dueDate}</span>` : "";
  return `<tr class="status-${row.evaluation.key}"><td>${row.label}</td><td>${money(row.budget)}</td><td>${money(row.actual)}</td><td>${money(row.projected)}</td><td>${money(row.remaining)}</td><td>${pct(row.paid)}</td><td>${dueDate}</td><td>${evaluationResult(row.evaluation)}</td></tr>`;
}

function projectionSpecialRow(row) {
  return `<tr class="status-${row.evaluation.key}"><td><strong>${row.label}</strong></td><td>${money(row.payments)}</td><td>${money(row.expenses)}</td><td class="${row.difference < 0 ? "danger" : "ok"}">${money(row.difference)}</td><td>${evaluationResult(row.evaluation)}</td></tr>`;
}

function smartModelPage() {
  const rows = smartModel(state);
  const pieMode = smartPieMode();
  const pie = smartPieData(rows, pieMode.key);
  return `
    <section class="panel smart-model-panel">
      <header class="smart-model-header">
        <div>
          <h2>Comparative Budget Balanced Income Distribution Structure</h2>
          <p class="muted">Based on average family size of 3 people. Refs are linked to the Budget Setup reference groups.</p>
        </div>
        <strong>Balanced model: ${pct(rows.reduce((total, row) => total + row.balanced, 0))}</strong>
      </header>
      <div class="table-wrap">
        <table class="smart-model-table">
          <thead>
            <tr><th>Groups</th><th>Concepts</th><th>Ref</th><th>Balanced Budget</th><th>Current Budget</th><th>Projected Values</th></tr>
          </thead>
          <tbody>${rows.map(smartModelRow).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="panel smart-chart-panel">
      <header class="smart-chart-header">
        <div>
          <h2>Income Distribution ${pieMode.label}</h2>
          <p class="muted">Type 1 for Balanced Model, 2 for Current Budget, or 3 for Projection.</p>
        </div>
        <label class="smart-pie-selector">Chart
          <input type="number" min="1" max="3" step="1" data-field="smartPieMode" value="${pieMode.value}" />
        </label>
      </header>
      <div class="smart-pie-wrap">
        <div class="smart-pie" style="background:${smartPieGradient(pie)}"></div>
        <div class="smart-pie-legend">${pie.map((row, index) => `<span><i style="background:${smartColor(index)}"></i>${row.ref}, ${pct(row.value)}</span>`).join("")}</div>
      </div>
    </section>
    <section class="panel smart-chart-panel">
      <h2>Comparison of Income Distribution</h2>
      <div class="smart-bars">${rows.map(smartBarGroup).join("")}</div>
      <footer class="smart-legend">
        <span><i class="balanced"></i>1 Balanced Budget</span>
        <span><i class="current"></i>2 Current Budget</span>
        <span><i class="projected"></i>3 Projected Values</span>
      </footer>
    </section>
  `;
}

function smartModelRow(row) {
  return `<tr>
    <td>${row.group}</td>
    <td>${row.concept}</td>
    <td>${row.ref}</td>
    <td>${pct(row.balanced)}</td>
    <td class="${smartVarianceClass(row.currentVariance)}">${pct(row.current)}</td>
    <td class="${smartVarianceClass(row.projectedVariance)}">${pct(row.projectedPercent)}</td>
  </tr>`;
}

function smartVarianceClass(variance) {
  const absolute = Math.abs(variance);
  return absolute > 0.05 ? "smart-risk" : absolute > 0.025 ? "smart-watch" : "smart-ok";
}

function smartPieMode() {
  const value = Math.min(3, Math.max(1, Math.round(Number(state.smartPieMode) || 1)));
  const modes = {
    1: { value, key: "balanced", label: "Balanced Model" },
    2: { value, key: "current", label: "Current Budget" },
    3: { value, key: "projectedPercent", label: "Projection" },
  };
  return modes[value];
}

function smartPieData(rows, key) {
  const values = rows.map((row) => ({ ...row, value: Math.max(0, Number(row[key]) || 0) }));
  const total = values.reduce((sum, row) => sum + row.value, 0);
  if (!total) return rows.map((row) => ({ ...row, value: row.balanced, slice: row.balanced }));
  return values.map((row) => ({ ...row, slice: row.value / total }));
}

function smartPieGradient(rows) {
  let start = 0;
  const stops = rows.map((row, index) => {
    const end = start + row.slice * 100;
    const stop = `${smartColor(index)} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function smartBarGroup(row) {
  const max = 0.35;
  return `<div class="smart-bar-group">
    <span>${row.ref}</span>
    ${smartBar(row.balanced, max, "balanced")}
    ${smartBar(row.current, max, "current")}
    ${smartBar(row.projectedPercent, max, "projected")}
  </div>`;
}

function smartBar(value, max, key) {
  return `<i class="${key}" title="${pct(value)}" style="height:${Math.min(100, (value / max) * 100)}%"></i>`;
}

function smartColor(index) {
  const colors = ["#5b9bd5", "#ed7d31", "#a5a5a5", "#ffc000", "#70ad47", "#255e91", "#9e480e", "#636363", "#997300", "#43682b", "#4472c4", "#f4b183", "#bdd7ee", "#ffd966", "#92d050"];
  return colors[index % colors.length];
}

function evaluation(p) {
  const difficultyScore = Math.min(100, Math.max(0, 100 - p.healthScore));
  return `
    <section class="metric-grid">
      ${metric("Financial health", Math.round(p.healthScore) + "/100", p.healthScore >= 80 ? "Strong" : p.healthScore >= 60 ? "Watch" : "Risk")}
      ${metric("Debt capacity", pct(p.debtToIncome), p.debtToIncome <= 0.35 ? "Within reference" : "Above reference")}
      ${metric("Credit coverage", money(p.creditCardPlanned), "Delays cash outflow")}
    </section>
    <section class="panel financial-evaluation-panel">
      <h2>Financial difficulty range</h2>
      <div class="financial-range" aria-label="Financial difficulty range">
        <span class="range-good">Low</span>
        <span class="range-watch">Medium</span>
        <span class="range-risk">High</span>
        <b style="left:${difficultyScore}%"><em>${Math.round(difficultyScore)}</em></b>
      </div>
      <div class="financial-range-labels"><span>0</span><span>40</span><span>60</span><span>100</span></div>
      <p class="muted financial-range-note">Difficulty is the inverse of the health score: green is low pressure, yellow is watch, and red is high risk.</p>
    </section>
    <section class="panel financial-evaluation-panel">
      <h2>Group evaluation</h2>
      <p class="muted financial-range-note">This evaluation compares the budget distribution with the Smart Model reference.</p>
      <div class="financial-group-ranges">
        ${financialGroupRows(p).map(financialGroupRow).join("")}
      </div>
    </section>
  `;
}

function financialGroupRows(p) {
  const modelRows = smartModel(state);
  const byRef = new Map(modelRows.map((row) => [row.ref, row]));
  const groupScore = (label, refs, direction = "maximum") => {
    const target = refs.reduce((total, ref) => total + Number(byRef.get(ref)?.balanced || 0), 0);
    const budgetShare = refs.reduce((total, ref) => total + Number(byRef.get(ref)?.current || 0), 0);
    const variance = direction === "minimum" ? target - budgetShare : budgetShare - target;
    const pressure = target ? Math.max(0, variance / target) : 0;
    const score = Math.min(100, Math.max(0, 20 + pressure * 80));
    return { label, score, evaluation: financialRangeEvaluation(score) };
  };
  const creditTarget = Number(byRef.get("2")?.balanced || 0.06);
  const creditShare = p.totalIncomeBudget ? Number(p.creditCardTotal || 0) / p.totalIncomeBudget : 0;
  const creditPressure = creditTarget ? Math.max(0, (creditShare - creditTarget) / creditTarget) : 0;
  const creditScore = Math.min(100, Math.max(0, 20 + creditPressure * 80));
  return [
    groupScore("Savings", ["0"], "minimum"),
    groupScore("Committed Debts", ["1", "3"]),
    groupScore("Household Expenses", ["4", "5", "6", "7", "8", "9", "10", "11", "12"]),
    groupScore("Extraordinary Expenses", ["13"]),
    groupScore("Miscellaneous", ["14"], "minimum"),
    { label: "Credit Cards", score: creditScore, evaluation: financialRangeEvaluation(creditScore) },
  ];
}

function financialGroupRow(row) {
  return `<article class="financial-group-range status-${row.evaluation.key}">
    <header><strong>${row.label}</strong>${evaluationResult(row.evaluation)}</header>
    <div class="financial-range financial-range-small" aria-label="${row.label} Smart Model comparison">
      <span class="range-good">Low</span>
      <span class="range-watch">Medium</span>
      <span class="range-risk">High</span>
      <b style="left:${row.score}%"></b>
    </div>
  </article>`;
}

function financialRangeEvaluation(score) {
  if (score <= 40) return { key: "good", label: "On track" };
  if (score <= 60) return { key: "watch", label: "Watch" };
  return { key: "problem", label: "Problem" };
}

function settings() {
  return `
    <section class="form-grid">
      <label>Language<select data-field="language">
        <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
        <option value="es" ${state.language === "es" ? "selected" : ""}>Español</option>
      </select></label>
      <label>Month<input type="month" data-field="month" value="${state.month}"/></label>
    </section>
    <section class="panel">
      <h2>Reference model</h2>
      <p class="muted">Debt-to-income target: 35%. Savings target: 10%. Mortgage capacity warning: 43%.</p>
      <button id="reset" class="secondary">Reset local data</button>
    </section>
  `;
}

function numberField(field, label) {
  return `<label>${label}<input type="number" step="0.01" data-field="${field}" value="${state[field]}" /></label>`;
}

function expenseTable() {
  return `
    <table>
      <thead><tr><th>Concept</th><th>Group</th><th>Amount</th><th>Due day</th><th>Reference</th><th></th></tr></thead>
      <tbody>
        ${state.expenses
          .map(
            (line, index) => `<tr>
              <td><input data-line="${index}" data-prop="concept" value="${line.concept}" /></td>
              <td><select data-line="${index}" data-prop="group">
                ${["debts", "household", "extraordinary"].map((group) => `<option value="${group}" ${line.group === group ? "selected" : ""}>${group}</option>`).join("")}
              </select></td>
              <td><input type="number" data-line="${index}" data-prop="amount" value="${line.amount}" /></td>
              <td><input type="number" min="1" max="31" data-line="${index}" data-prop="dueDay" value="${line.dueDay}" /></td>
              <td><input data-line="${index}" data-prop="reference" value="${line.reference || ""}" /></td>
              <td><button class="icon danger-text" data-remove-line="${index}" title="Remove">×</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function metric(label, value, detail) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function bars(items) {
  return `<div class="bars">${items
    .map(([label, value, total]) => `<div><span>${label}</span><b>${money(value)}</b><i><em style="width:${Math.min(100, total ? (value / total) * 100 : 0)}%"></em></i></div>`)
    .join("")}</div>`;
}

function transactionConceptName(tx) {
  const fixedConcepts = {
    "net-income": "Net Income",
    "other-deposits": "Other Deposits",
    "savings-account": "Saving",
  };
  return fixedConcepts[tx.conceptId] || state.expenses.find((line) => line.id === tx.conceptId)?.concept || "Movement";
}

function transactionRows(transactions) {
  if (!transactions.length) return `<tr><td colspan="7" class="muted">No actual movements match the current filters.</td></tr>`;
  return transactions
    .map(
      (tx) => `<tr>
        <td>${tx.date || ""}</td>
        <td>${tx.type || ""}</td>
        <td>${transactionConceptName(tx)}</td>
        <td>${money(tx.amount)}</td>
        <td>${tx.paymentMethod || ""}</td>
        <td>${tx.comment || ""}</td>
        <td><button class="icon danger-text" type="button" data-remove-transaction="${tx.id}" title="Delete transaction">x</button></td>
      </tr>`,
    )
    .join("");
}

function bindEvents() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      page = button.dataset.page;
      render();
    });
  });
  document.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const field = input.dataset.field;
      state[field] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      saveState(state);
      render();
    });
  });
  document.querySelector("[data-field='smartPieMode']")?.addEventListener("input", (event) => {
    state.smartPieMode = Number(event.target.value) || 1;
    saveState(state);
    render();
  });
  document.querySelectorAll("[data-transaction-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      state.transactionFilters = {
        dateFrom: "",
        dateTo: "",
        type: "all",
        conceptId: "all",
        paymentMethod: "all",
        ...(state.transactionFilters || {}),
        [input.dataset.transactionFilter]: input.value,
      };
      saveState(state);
      render();
    });
  });
  document.querySelector("#clear-tx-filters")?.addEventListener("click", () => {
    state.transactionFilters = {
      dateFrom: "",
      dateTo: "",
      type: "all",
      conceptId: "all",
      paymentMethod: "all",
    };
    saveState(state);
    render();
  });
  document.querySelectorAll("[data-remove-transaction]").forEach((button) => {
    button.addEventListener("click", () => {
      state.transactions = state.transactions.filter((tx) => tx.id !== button.dataset.removeTransaction);
      saveState(state);
      render();
    });
  });
  document.querySelector("#clear-month-data")?.addEventListener("click", () => {
    state.transactions = [];
    state.currentCashFlow = 0;
    state.currentSavings = 0;
    state.lastActualUpdate = "";
    state.transactionFilters = {
      dateFrom: "",
      dateTo: "",
      type: "all",
      conceptId: "all",
      paymentMethod: "all",
    };
    saveState(state);
    render();
  });
  document.querySelectorAll("[data-actual-balance]").forEach((input) => {
    input.addEventListener("input", () => {
      state[input.dataset.actualBalance] = Number(input.value);
      state.lastActualUpdate = localDateValue();
      saveState(state);
      showCurrentActualUpdate();
    });
    input.addEventListener("change", () => {
      render();
    });
  });
  document.querySelectorAll("[data-line]").forEach((input) => {
    input.addEventListener("change", () => {
      const line = state.expenses[Number(input.dataset.line)];
      line[input.dataset.prop] = input.type === "number" ? Number(input.value) : input.value;
      saveState(state);
      render();
    });
  });
  document.querySelectorAll(".reference-select").forEach((select) => {
    select.addEventListener("pointerdown", () => toggleReferenceDescriptions(select, true));
    select.addEventListener("focus", () => toggleReferenceDescriptions(select, true));
    select.addEventListener("blur", () => toggleReferenceDescriptions(select, false));
  });
  document.querySelectorAll("[data-remove-line]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expenses.splice(Number(button.dataset.removeLine), 1);
      saveState(state);
      render();
    });
  });
  document.querySelectorAll("[data-add-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.addGroup;
      const defaults = {
        debts: { concept: "Other debt", reference: "3" },
        household: { concept: "Monthly expense", reference: "4" },
        extraordinary: { concept: "Non-monthly expense", reference: "13" },
      };
      state.expenses.push({
        id: crypto.randomUUID(),
        concept: defaults[group].concept,
        amount: 0,
        dueDay: 15,
        group,
        reference: defaults[group].reference,
      });
      saveState(state);
      render();
    });
  });
  document.querySelector("#tx-type")?.addEventListener("change", (event) => {
    document.querySelector("#tx-concept").innerHTML = transactionConceptOptions(event.target.value);
  });
  document.querySelector("#tx-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    state.transactions.unshift({ id: crypto.randomUUID(), ...data, amount: Number(data.amount) });
    state.lastActualUpdate = localDateValue();
    saveState(state);
    render();
  });
  document.querySelector("#reset")?.addEventListener("click", () => {
    state = resetState();
    page = "budget";
    render();
  });
}

render();
