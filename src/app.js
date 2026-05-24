import { calculateProjection, money, pct, projectionRows, sum } from "./calculations/budgetEngine.js";
import { defaultState, loadState, resetState, saveState } from "./data/defaultState.js";
import { copy } from "./i18n/index.js";

let state = loadState();
let page = "budget";
const app = document.querySelector("#app");

function render() {
  const t = copy[state.language] || copy.en;
  const projection = calculateProjection(state);
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
    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">Monthly predictive planning</p>
          <h1>${t[page]}</h1>
        </div>
        <div class="month-chip">${state.month}</div>
      </header>
      ${projection.alerts.length ? `<section class="alerts">${projection.alerts.map((a) => `<p>${a}</p>`).join("")}</section>` : ""}
      ${page === "dashboard" ? dashboard(projection) : ""}
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

function dashboard(p) {
  return `
    <section class="metric-grid">
      ${metric("Budgeted income", money(p.totalIncomeBudget), "Projected " + money(p.totalProjectedIncome))}
      ${metric("Budgeted expenses", money(p.totalExpensesBudget), "Projected " + money(p.totalProjectedExpenses))}
      ${metric("Current cash flow", money(state.currentCashFlow), "End forecast " + money(p.expectedEndCashFlow))}
      ${metric("Savings", money(state.currentSavings), "Projected " + money(p.projectedSavings))}
      ${metric("Credit cards", money(p.creditCardActual), "Planned coverage " + money(p.creditCardPlanned))}
      ${metric("Debt-to-income", pct(p.debtToIncome), p.debtToIncome <= 0.35 ? "Acceptable" : "Review")}
    </section>
    <section class="panel">
      <h2>Budget vs projected structure</h2>
      ${bars([
        ["Debts", p.committedDebts, p.totalExpensesBudget],
        ["Household", p.householdExpenses, p.totalExpensesBudget],
        ["Extraordinary", p.extraordinaryExpenses, p.totalExpensesBudget],
        ["Miscellaneous", Math.max(0, p.miscellaneous), p.totalExpensesBudget],
      ])}
    </section>
  `;
}

function budgetSetup(p) {
  return `
    <section class="form-grid">
      ${numberField("regularIncome", "Regular income")}
      ${numberField("irregularIncome", "Irregular income")}
      ${numberField("estimatedTaxPercent", "Estimated tax %")}
      ${numberField("initialCashFlow", "Initial cash flow")}
      ${numberField("currentCashFlow", "Current cash flow")}
      ${numberField("desiredFinalCashFlow", "Desired final cash flow")}
      ${numberField("initialSavings", "Initial savings")}
      ${numberField("currentSavings", "Current savings")}
      ${numberField("budgetedSavings", "Budgeted savings")}
      ${numberField("savingsDepositDay", "Savings deposit day")}
      ${numberField("plannedCreditCardSpending", "Planned card spending")}
    </section>
    <section class="panel formula-panel">
      <div>
        <h2>Automatic miscellaneous</h2>
        <p>FEI + IR + II - VIV - PTC - GG - GE - AP + GTC - FDF</p>
      </div>
      <strong class="${p.miscellaneousRaw < 0 ? "danger" : "ok"}">${money(p.miscellaneous)}</strong>
      <label class="toggle"><input type="checkbox" data-field="crisisMode" ${state.crisisMode ? "checked" : ""}/> Crisis mode</label>
    </section>
    <section class="panel">
      <div class="section-head">
        <h2>Controlled expense concepts</h2>
        <button class="primary" id="add-line">Add concept</button>
      </div>
      <div class="table-wrap">${expenseTable()}</div>
    </section>
  `;
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
  document.querySelectorAll("[data-remove-line]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expenses.splice(Number(button.dataset.removeLine), 1);
      saveState(state);
      render();
    });
  });
  document.querySelector("#add-line")?.addEventListener("click", () => {
    state.expenses.push({ id: crypto.randomUUID(), concept: "New concept", amount: 0, dueDay: 15, group: "household", reference: "2HOEXP" });
    saveState(state);
    render();
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
