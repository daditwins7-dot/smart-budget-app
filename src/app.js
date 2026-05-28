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
  return `
    <section class="panel transaction-panel">
      <h2>Record actual movement</h2>
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
      <p class="transaction-rules">Only budgeted expense concepts are available for tracking. Miscellaneous is calculated by the system and is not recorded here. Payment Method is required for accurate cash flow and credit card balances; select Cash or Credit card correctly for each expense. Credit card expenses and payments are accumulated totals; identify individual card activity in Comment. Savings are not recorded as transactions because bank balances define increases or reductions; when savings are used for payments, reduce the savings balance and increase payments or cash flow as applicable.</p>
    </section>
    <section class="card-list">${state.transactions.map(txCard).join("") || `<p class="muted">No actual movements yet.</p>`}</section>
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
          <h2>Balances</h2>
          <div class="table-wrap">
            <table class="projection-balance-table">
              <thead><tr><th>Balance</th><th>Initial</th><th>Actual</th><th>Projected</th></tr></thead>
              <tbody>${model.balanceRows.map(projectionBalanceRow).join("")}</tbody>
            </table>
          </div>
        </div>
        ${projectionPaymentTiming(model.paymentTiming)}
      </div>
    </section>
    <section class="panel projection-panel">
      <div class="projection-section-head">
        <div>
          <h2>Income and Expenses</h2>
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

function projectionBalanceRow(row) {
  return `<tr class="status-${row.evaluation.key}"><td><strong>${row.label}</strong></td><td>${money(row.initial)}</td><td>${money(row.actual)}</td><td>${money(row.projected)}</td></tr>`;
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
        <thead><tr><th>Concept</th><th>Budget</th><th>Actual</th><th>Projected</th><th>Remaining</th><th>% Paid</th><th>Evaluation</th></tr></thead>
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
  return `<tr class="status-${row.evaluation.key}"><td>${row.label}</td><td>${money(row.budget)}</td><td>${money(row.actual)}</td><td>${money(row.projected)}</td><td>${money(row.remaining)}</td><td>${pct(row.paid)}</td><td>${evaluationResult(row.evaluation)}</td></tr>`;
}

function projectionSpecialRow(row) {
  return `<tr class="status-${row.evaluation.key}"><td><strong>${row.label}</strong></td><td>${money(row.payments)}</td><td>${money(row.expenses)}</td><td class="${row.difference < 0 ? "danger" : "ok"}">${money(row.difference)}</td><td>${evaluationResult(row.evaluation)}</td></tr>`;
}

function smartModelPage() {
  const rows = smartModel(state);
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
      <h2>Income Distribution Balanced Budget</h2>
      <div class="smart-pie-wrap">
        <div class="smart-pie" style="background:${smartPieGradient(rows)}"></div>
        <div class="smart-pie-legend">${rows.map((row, index) => `<span><i style="background:${smartColor(index)}"></i>${row.ref}, ${pct(row.balanced)}</span>`).join("")}</div>
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

function smartPieGradient(rows) {
  let start = 0;
  const stops = rows.map((row, index) => {
    const end = start + row.balanced * 100;
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
      <div class="table-wrap">
        <table class="financial-group-table">
          <thead><tr><th>Group</th><th>Budget</th><th>Projected</th><th>Share</th><th>Evaluation</th></tr></thead>
          <tbody>${financialGroupRows(p).map(financialGroupRow).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function financialGroupRows(p) {
  const groupProjection = (label, group) => {
    const ids = state.expenses.filter((line) => line.group === group).map((line) => line.id);
    const budget = state.expenses.filter((line) => line.group === group).reduce((total, line) => total + Number(line.amount || 0), 0);
    const actual = state.transactions.filter((tx) => tx.type === "expense" && ids.includes(tx.conceptId)).reduce((total, tx) => total + Number(tx.amount || 0), 0);
    const projected = Math.max(budget, actual);
    return { label, budget, projected, evaluation: financialLowerIsBetter(projected, budget) };
  };
  const savingsTarget = Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0);
  const rows = [
    { label: "Savings", budget: Number(state.budgetedSavings || 0), projected: p.projectedSavings - Number(state.initialSavings || 0), evaluation: p.projectedSavings >= savingsTarget ? { key: "good", label: "On track" } : { key: "watch", label: "Watch" } },
    groupProjection("Committed Debts", "debts"),
    groupProjection("Household Expenses", "household"),
    groupProjection("Extraordinary Expenses", "extraordinary"),
    { label: "Miscellaneous", budget: p.miscellaneous, projected: p.miscellaneousProjected, evaluation: p.miscellaneousProjected < 0 ? { key: "problem", label: "Problem" } : financialLowerIsBetter(p.miscellaneousProjected, p.miscellaneous) },
    { label: "Credit Cards", budget: p.creditCardPlanned, projected: p.creditCardActual, evaluation: financialLowerIsBetter(p.creditCardActual, p.creditCardPlanned) },
  ];
  return rows.map((row) => ({ ...row, share: p.totalIncomeBudget ? row.projected / p.totalIncomeBudget : 0 }));
}

function financialGroupRow(row) {
  return `<tr class="status-${row.evaluation.key}"><td><strong>${row.label}</strong></td><td>${money(row.budget)}</td><td>${money(row.projected)}</td><td>${pct(row.share)}</td><td>${evaluationResult(row.evaluation)}</td></tr>`;
}

function financialLowerIsBetter(value, target) {
  if (!target || value <= target) return { key: "good", label: "On track" };
  if (value <= target * 1.1) return { key: "watch", label: "Watch" };
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

function txCard(tx) {
  const fixedConcepts = {
    "net-income": "Net Income",
    "other-deposits": "Other Deposits",
    "savings-account": "Saving",
  };
  const concept = fixedConcepts[tx.conceptId] || state.expenses.find((line) => line.id === tx.conceptId)?.concept || "Movement";
  return `<article class="tx-card"><strong>${concept}</strong><span>${tx.date}</span><b>${money(tx.amount)}</b><small>${tx.type} · ${tx.paymentMethod}</small></article>`;
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
