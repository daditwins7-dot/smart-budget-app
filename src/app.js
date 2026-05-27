import { dashboardModel, money, pct, projectionRows } from "./calculations/budgetEngine.js";
import { loadState, resetState, saveState } from "./data/defaultState.js";
import { copy } from "./i18n/index.js";

let state = loadState();
const initialPage = new URLSearchParams(window.location.search).get("page");
let page = ["dashboard", "budget", "transactions", "projections", "evaluation", "settings"].includes(initialPage)
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
  const dashboardData = dashboardModel(state);
  const projection = dashboardData.projection;
  app.innerHTML = `
    <aside class="shell-nav">
      <div class="brand"><span>SMART</span><strong>BUDGET</strong></div>
      ${navButton("dashboard", t.dashboard)}
      ${navButton("budget", t.budget)}
      ${navButton("transactions", t.transactions)}
      ${navButton("projections", t.projections)}
      ${navButton("evaluation", t.evaluation)}
      ${navButton("settings", t.settings)}
    </aside>
    <main class="workspace ${page === "dashboard" ? "dashboard-workspace" : ""}">
      ${page !== "dashboard" && page !== "budget" ? `<header class="topbar">
        <div>
          <p class="eyebrow">Monthly predictive planning</p>
          <h1>${t[page]}</h1>
        </div>
        <div class="month-chip">${state.month}</div>
      </header>` : ""}
      ${page !== "dashboard" && page !== "budget" && projection.alerts.length ? `<section class="alerts">${projection.alerts.map((a) => `<p>${a}</p>`).join("")}</section>` : ""}
      ${page === "dashboard" ? dashboard(dashboardData) : ""}
      ${page === "budget" ? budgetSetup(projection) : ""}
      ${page === "transactions" ? transactions() : ""}
      ${page === "projections" ? projections() : ""}
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
        <h2>Calculated Miscellaneous Balance</h2>
        <table class="budget-simple misc-table">
          <thead><tr><th>Concept</th><th>Amount</th><th>Ref</th></tr></thead>
          <tbody><tr><td>Automatic Balance Adjustment</td><td class="${p.miscellaneous < 0 ? "danger" : "ok"}">${money(p.miscellaneous)}</td><td>14</td></tr></tbody>
        </table>
        <p class="budget-note">Keeps available income equal to total expenses in the monthly budget.</p>
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
      <footer class="budget-footer">
        <label class="toggle"><input type="checkbox" data-field="crisisMode" ${state.crisisMode ? "checked" : ""}/> Crisis mode</label>
        <span class="${p.budgetBalanceDifference === 0 ? "ok" : "danger"}">Balance check: ${money(p.budgetBalanceDifference)}</span>
      </footer>
    </section>
  `;
}

function budgetExpenseSection(title, group, note) {
  return `
    <section class="budget-section expense-setup">
      <div class="budget-section-head">
        <h2>${title}</h2>
        ${group === "debts" ? "" : `<button class="secondary add-concept" data-add-group="${group}" type="button">+ Add concept</button>`}
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
            <td>${group === "debts" ? "" : `<button class="icon danger-text" data-remove-line="${index}" title="Remove concept">x</button>`}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>
  `;
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
  return `
    <section class="panel">
      <h2>Record actual movement</h2>
      <form id="tx-form" class="transaction-form">
        <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
        <select name="conceptId">${state.expenses.map((line) => `<option value="${line.id}">${line.concept}</option>`).join("")}</select>
        <input name="amount" type="number" step="0.01" placeholder="Amount" required />
        <select name="type">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="saving">Saving</option>
          <option value="creditCardPayment">Credit card payment</option>
        </select>
        <select name="paymentMethod">
          <option value="cash">Cash</option>
          <option value="creditCard">Credit card</option>
        </select>
        <input name="comment" placeholder="Comment" />
        <button class="primary">Add</button>
      </form>
    </section>
    <section class="card-list">${state.transactions.map(txCard).join("") || `<p class="muted">No actual movements yet.</p>`}</section>
  `;
}

function projections() {
  return `
    <section class="panel">
      <h2>Projection analysis</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Group</th><th>Budget</th><th>Actual</th><th>Projected</th><th>Remaining</th><th>% paid</th></tr></thead>
          <tbody>${projectionRows(state)
            .map((row) => `<tr><td>${row.label}</td><td>${money(row.budget)}</td><td>${money(row.actual)}</td><td>${money(row.projected)}</td><td>${money(row.remaining)}</td><td>${pct(row.paid)}</td></tr>`)
            .join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function evaluation(p) {
  return `
    <section class="metric-grid">
      ${metric("Financial health", Math.round(p.healthScore) + "/100", p.healthScore >= 80 ? "Strong" : p.healthScore >= 60 ? "Watch" : "Risk")}
      ${metric("Debt capacity", pct(p.debtToIncome), p.debtToIncome <= 0.35 ? "Within reference" : "Above reference")}
      ${metric("Credit coverage", money(p.creditCardPlanned), "Delays cash outflow")}
    </section>
    <section class="panel">
      <h2>Health thermometer</h2>
      <div class="thermometer"><span style="width:${p.healthScore}%"></span></div>
      ${bars([
        ["Savings", state.budgetedSavings, p.totalIncomeBudget],
        ["Debts", p.committedDebts, p.totalIncomeBudget],
        ["Expenses", p.totalExpensesBudget, p.totalIncomeBudget],
      ])}
    </section>
  `;
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
  const concept = state.expenses.find((line) => line.id === tx.conceptId)?.concept || "Income";
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
  document.querySelector("#tx-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    state.transactions.unshift({ id: crypto.randomUUID(), ...data, amount: Number(data.amount) });
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
