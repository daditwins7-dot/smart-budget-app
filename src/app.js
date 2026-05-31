import { dashboardModel, money, pct, projectionAnalysisModel, smartModel } from "./calculations/budgetEngine.js";
import { clearActualMonthState, loadState, reconcileState, resetState, saveState } from "./data/defaultState.js";
import { copy } from "./i18n/index.js";

let state = loadState();
const initialPage = new URLSearchParams(window.location.search).get("page");
let page = ["dashboard", "budget", "transactions", "projections", "history", "smartModel", "evaluation", "help", "settings"].includes(initialPage)
  ? initialPage
  : "dashboard";
const app = document.querySelector("#app");
const validPages = ["dashboard", "budget", "transactions", "projections", "history", "smartModel", "evaluation", "help", "settings"];
const TERMS_VERSION = "2026-05-31";
let helpMessages = initialHelpMessages();
let showTermsModal = false;
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

function initialHelpMessages() {
  return [
    {
      role: "assistant",
      text: helpText("initialMessage"),
    },
  ];
}

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
      ${navButton("history", t.history || "History")}
      ${navButton("smartModel", t.smartModel || "Smart Model")}
      ${navButton("evaluation", t.evaluation)}
      ${navButton("help", t.help || "Smart Help Chat")}
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
      ${dataQualityNotice(dashboardData)}
      ${page !== "dashboard" && page !== "budget" && projection.alerts.length ? `<section class="alerts">${projection.alerts.map((a) => `<p>${a}</p>`).join("")}</section>` : ""}
      ${page === "dashboard" ? dashboard(dashboardData) : ""}
      ${page === "budget" ? budgetSetup(projection) : ""}
      ${page === "transactions" ? transactions() : ""}
      ${page === "projections" ? projections() : ""}
      ${page === "history" ? historyPage() : ""}
      ${page === "smartModel" ? smartModelPage() : ""}
      ${page === "evaluation" ? evaluation(projection) : ""}
      ${page === "help" ? smartHelpPage(projection) : ""}
      ${page === "settings" ? settings() : ""}
    </main>
    ${termsAcceptanceOverlay()}
  `;
  bindEvents();
}

function navButton(id, label) {
  return `<button class="nav-button ${page === id ? "active" : ""}" data-page="${id}">${label}</button>`;
}

function termsAccepted() {
  return state.termsAcceptedVersion === TERMS_VERSION;
}

function termsAcceptanceOverlay() {
  const mustAccept = !termsAccepted();
  if (!mustAccept && !showTermsModal) return "";
  return `<section class="terms-overlay" role="dialog" aria-modal="true" aria-labelledby="terms-title">
    <article class="terms-modal">
      <header class="terms-modal-head">
        <div>
          <p class="eyebrow">Home Smart Financial Systems</p>
          <h2 id="terms-title">Terms and Conditions of Use</h2>
          <p class="muted">SMART BUDGET - Version ${TERMS_VERSION}</p>
        </div>
        ${!mustAccept ? `<button class="icon terms-close" type="button" data-close-terms title="Close">x</button>` : ""}
      </header>
      <div class="terms-content">
        ${termsAndConditionsMarkup()}
      </div>
      <footer class="terms-actions">
        <p>${mustAccept ? "You must accept these Terms and Conditions before using Smart Budget." : `Accepted version: ${state.termsAcceptedVersion || "Not recorded"}`}</p>
        <button class="primary" type="button" data-accept-terms>${mustAccept ? "I accept and continue" : "Accept current terms"}</button>
      </footer>
    </article>
  </section>`;
}

function termsAndConditionsMarkup() {
  return `
    <h3>1. Free Use and Donations</h3>
    <p>The free systems developed by HOME SMART FINANCIAL SYSTEMS, including SMART BUDGET, may be used without any mandatory payment, except for any applicable download, access, or license terms expressly stated by HOME SMART FINANCIAL SYSTEMS. Voluntary donations may be accepted to support ongoing development, maintenance, and improvement of the tools offered.</p>

    <h3>2. Payments and Validity</h3>
    <p>Payments for licenses, when applicable, will be made exclusively online by credit card, PayPal, or another payment method authorized by HOME SMART FINANCIAL SYSTEMS. This agreement begins when the customer or authorized user downloads, accesses, installs, or uses any HOME SMART FINANCIAL SYSTEMS software product, including Smart Budget, Affordable Mortgage, and Amortization Financial Tool. The agreement remains active as long as the customer complies with these terms, unless otherwise provided by HOME SMART FINANCIAL SYSTEMS.</p>

    <h3>3. Grant of License</h3>
    <p>Upon payment, when payment is required, HOME SMART FINANCIAL SYSTEMS grants the customer a limited, revocable, non-exclusive, non-transferable, and non-sublicensable license to use the software in accordance with this agreement. No ownership rights are transferred.</p>

    <h3>4. Use of the Product</h3>
    <p>Only authorized users may use HOME SMART FINANCIAL SYSTEMS products. The customer may create working copies with different names in the same authorized location for personal or internal use, provided such copies do not violate the license terms. Partial or total reproduction, distribution, resale, publication, or transfer of the product is not authorized except for one backup copy kept in the same authorized folder or location. Multiple or volume licenses may be installed on different computers or locations only up to the number of licenses purchased.</p>
    <p>Any modification made by the customer does not grant ownership or intellectual property rights in the software. All copyright, authorship, and intellectual property notices must remain intact unless expressly authorized in writing. The customer may not allow any third party to modify, copy, distribute, export, or use the software in violation of United States export control laws or other applicable laws.</p>

    <h3>5. Ownership</h3>
    <p>The purchase or use of a license does not grant ownership of the software. All products, formulas, designs, interfaces, documentation, and related intellectual property remain the exclusive property of HOME SMART FINANCIAL SYSTEMS, except for any user-entered data.</p>

    <h3>6. Delivery of the Product</h3>
    <p>The software may be delivered through a digital download link, web access link, email, or another electronic delivery method provided by HOME SMART FINANCIAL SYSTEMS. The customer is responsible for providing accurate contact information when payment, download, or access is required.</p>

    <h3>7. Limitation of Liability</h3>
    <p>HOME SMART FINANCIAL SYSTEMS shall not be liable for calculation errors, inaccurate assumptions, user input errors, formula differences, software or hardware failures, browser storage issues, loss of data, network failures, interruption of service, or financial losses arising from the use of the software. Since the functions, formulas, assumptions, and projections used may differ from those of other similar programs, any decision made based on the results presented is the sole responsibility of the user.</p>
    <p>SMART BUDGET is a budgeting and projection tool based only on the values entered by the user. It does not provide financial, legal, tax, credit, accounting, or investment advice. Users should verify all information independently before making financial decisions.</p>

    <h3>8. System Authorship and Responsibility</h3>
    <p>This system has been developed by Roman Martinez, who acts as author, designer, and technical manager of the content and operation of the products offered by HOME SMART FINANCIAL SYSTEMS. Questions, suggestions, or requests related to the system may be addressed directly by email to: <a href="mailto:rmartinez900@comcast.net">rmartinez900@comcast.net</a>.</p>

    <h3>Acceptance</h3>
    <p>By downloading, accessing, installing, or using this product, the customer or authorized user expressly agrees to all terms and conditions set forth in this agreement.</p>
    <p><strong>Copyright © HOME SMART FINANCIAL SYSTEMS. All rights reserved.</strong></p>
  `;
}

function dataQualityNotice(model) {
  const issues = dataQualityIssues(model.projection);
  if (!issues.length && !state.dataNotice) return "";
  return `<section class="data-quality-notice">
    <div>
      <strong>Data check before decisions</strong>
      ${state.dataNotice ? `<p>${state.dataNotice}</p>` : ""}
      ${issues.map((issue) => `<p>${issue}</p>`).join("")}
    </div>
    <div class="notice-actions">
      <button class="secondary" type="button" data-reconcile-data>Synchronize and recalculate</button>
      <button class="secondary" type="button" data-clear-actual-month>New month: reset actuals only</button>
    </div>
  </section>`;
}

function dataQualityIssues(p) {
  const issues = [];
  const hasTransactions = state.transactions.length > 0;
  const hasBalances = Number(state.currentCashFlow || 0) !== 0 || Number(state.currentSavings || 0) !== 0;
  const incomeTransactions = state.transactions.filter((tx) => tx.type === "income").length;
  const expenseTransactions = state.transactions.filter((tx) => tx.type === "expense").length;

  if (hasBalances && !hasTransactions) {
    issues.push("Actual balances exist but no transactions are recorded. Projection can look inconsistent until movements are entered or month data is cleared.");
  }
  if (hasTransactions && (!state.lastActualUpdate || state.lastActualUpdate !== localDateValue())) {
    issues.push("Transactions were saved on a different date. Confirm balances in Update Transactions so projected days and cash flow use the latest actual date.");
  }
  if (incomeTransactions === 0 && expenseTransactions > 0) {
    issues.push("Expenses are recorded without income transactions. Available income may appear too low until income deposits are entered.");
  }
  if (Number(p.miscellaneousActualRaw || 0) < 0) {
    issues.push("Actual Miscellaneous is negative. This usually means transactions or balances are missing; correct Cash Flow, Savings, income, card purchases, or payments before continuing.");
  }
  if (Math.abs(Number(p.actualBalanceDifference || 0)) > 0.01 || Math.abs(Number(p.projectedBalanceDifference || 0)) > 0.01) {
    issues.push("Balance check is not zero. Use Synchronize and recalculate first; if numbers remain wrong, reset actual month data and re-enter balances and transactions.");
  }
  return issues;
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
      ${balanceCorrectionPanel(p, "dashboard")}
      ${actionSuggestionPanel(p, "dashboard")}
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
    ${balanceCorrectionPanel(model.projection, "projection")}
    <section class="panel projection-panel">
      <div class="projection-section-head">
        <div>
          <h2>Expenses</h2>
          <p class="muted projection-note">Expand a budget group to review each tracked concept.</p>
        </div>
        <div class="projection-controls">
          <label class="toggle"><input type="checkbox" data-field="crisisMode" ${state.crisisMode ? "checked" : ""}/> Crisis mode</label>
          <span class="${balanceDifferences(model.projection).some((item) => item.outOfBalance) ? "danger" : "ok"}">Balance check: ${money(totalBalanceDifference(model.projection))}</span>
        </div>
      </div>
      <div class="projection-grid projection-grid-header">
        <span>Group</span><span>Budget</span><span>Actual</span><span>Projected</span><span>Remaining</span><span>% Paid</span><span>Evaluation</span>
      </div>
      ${projectionStandardRow(model.expenseTotalRow)}
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
    <div class="payment-timing-row">
      <span>Overdue Payments</span>
      <strong>${money(timing.overdueAmount)}</strong>
    </div>
    <div class="payment-timing-row future">
      <span>Future Committed Payments</span>
      <label>Next Days <input type="number" min="0" max="31" step="1" data-field="projectionNextDays" value="${timing.nextDays}" /></label>
      <small>Date ${timing.futureDate}</small>
      <strong>${money(timing.futureCommittedAmount)}</strong>
    </div>
  </aside>`;
}

function balanceCorrectionPanel(p, context) {
  const differences = balanceDifferences(p);
  const outOfBalance = differences.filter((item) => item.outOfBalance);
  if (!outOfBalance.length) return "";
  return `<section class="panel balance-correction-panel balance-correction-${context}">
    <div class="balance-correction-head">
      <div>
        <h2>Balance mismatch detected</h2>
        <p>Available Income and Total Expenses must match before using these numbers for decisions.</p>
      </div>
      <div class="notice-actions">
        <button class="secondary" type="button" data-reconcile-data>Synchronize and recalculate</button>
        <button class="secondary" type="button" data-clear-actual-month>New month: reset actuals only</button>
      </div>
    </div>
    <div class="balance-difference-grid">
      ${differences.map(balanceDifferenceCard).join("")}
    </div>
    <h3>Correction steps</h3>
    <ol>${balanceCorrectionSteps(outOfBalance).map((step) => `<li>${step}</li>`).join("")}</ol>
  </section>`;
}

function balanceDifferences(p) {
  return [
    { label: "Budget", difference: Number(p.budgetBalanceDifference || 0) },
    { label: "Actual", difference: Number(p.actualBalanceDifference || 0) },
    { label: "Projected", difference: Number(p.projectedBalanceDifference || 0) },
  ].map((item) => ({ ...item, outOfBalance: Math.abs(item.difference) > 0.01 }));
}

function totalBalanceDifference(p) {
  return balanceDifferences(p).reduce((total, item) => total + Math.abs(item.difference), 0);
}

function balanceDifferenceCard(item) {
  return `<article class="${item.outOfBalance ? "danger" : "ok"}">
    <span>${item.label}</span>
    <strong>${money(item.difference)}</strong>
  </article>`;
}

function balanceCorrectionSteps(items) {
  const labels = new Set(items.map((item) => item.label));
  const steps = [];
  if (labels.has("Budget")) {
    steps.push("Review Budget Setup: income, planned savings, cash flow budget, credit card budget/overdraft, and miscellaneous.");
  }
  if (labels.has("Actual")) {
    steps.push("Review Update Transactions: confirm current Cash Flow, current Savings, all income deposits, card purchases, credit card payments, and negative Actual Miscellaneous.");
  }
  if (labels.has("Projected")) {
    steps.push("Review Projection Analysis: confirm Last Update Date, remaining days, miscellaneous trend, and whether card spending is increasing or reducing cash flow.");
  }
  steps.push("Click Synchronize and recalculate after a system update; if the warning remains, reset actual month data and re-enter current balances and transactions.");
  return steps;
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

function historyPage() {
  const currentYear = Number(String(state.month || new Date().getFullYear()).slice(0, 4)) || new Date().getFullYear();
  const snapshots = (state.historySnapshots || [])
    .filter((snapshot) => Number(snapshot.year) === currentYear)
    .sort(historySnapshotSort);
  const completedSnapshots = snapshots.filter((snapshot) => historySnapshotKind(snapshot) === "final");
  const monthToDateSnapshot = snapshots.find((snapshot) => snapshot.month === state.month && historySnapshotKind(snapshot) === "mtd");
  const rows = historyConceptRows();
  return `
    <section class="panel history-panel">
      <div class="history-head">
        <div>
          <h2>History</h2>
          <p class="muted">Update month-to-date while the month is open, then save the completed month when actual values are final.</p>
        </div>
        <div class="history-actions">
          <button class="secondary" type="button" data-save-history-mtd>Update Month-to-date</button>
          <button class="primary" type="button" data-save-history-final>Save Completed Month</button>
          <small>Update Month-to-date on the last day of the month, after entering all final values. Updating before or after month end can change projections, especially miscellaneous.</small>
        </div>
      </div>
      <div class="history-summary-grid">
        ${historySummaryCards(snapshots).join("")}
      </div>
    </section>
    <section class="panel history-panel">
      <h2>${currentYear} Concept History</h2>
      <div class="table-wrap">
        <table class="history-table">
          <thead>
            <tr class="history-date-row">
              <th></th>
              <th class="history-update-cell" colspan="2">Last update: ${displayShortDate(monthToDateSnapshot?.generatedDate || monthToDateSnapshot?.savedAt) || "Not updated"}</th>
              <th></th>
              ${completedSnapshots.map(() => "<th></th>").join("")}
            </tr>
            <tr>
              <th>Concept</th>
              <th>Budget</th>
              <th>Projection</th>
              <th>Average Year</th>
              ${completedSnapshots.map((snapshot) => `<th>${historySnapshotHeader(snapshot)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows.map((row) => historyConceptRow(row, completedSnapshots)).join("")}</tbody>
          ${historyDeleteTableRow(completedSnapshots)}
        </table>
      </div>
      ${completedSnapshots.length ? "" : `<p class="muted history-empty">No completed months saved for ${currentYear} yet. Month-to-date stays in the update date above.</p>`}
    </section>
  `;
}

function historyDeleteTableRow(snapshots) {
  if (!snapshots.length) return "";
  return `<tfoot>
    <tr class="history-delete-table-row">
      <td><strong>Delete Month</strong></td>
      <td></td><td></td><td></td>
      ${snapshots.map((snapshot) => `<td><button class="icon danger-text" type="button" data-remove-history-snapshot="${snapshot.id}" title="Delete ${historySnapshotTitle(snapshot)}">X</button></td>`).join("")}
    </tr>
  </tfoot>`;
}

function historySummaryCards(snapshots) {
  if (!snapshots.length) {
    return [
      historyMetric("Snapshots", "0", "Save the current month to start history."),
      historyMetric("Average Cash End", money(0), "Current year"),
      historyMetric("Average Expenses Actual", money(0), "Current year"),
      historyMetric("Average Misc. Actual", money(0), "Current year"),
    ];
  }
  const completed = snapshots.filter((snapshot) => historySnapshotKind(snapshot) === "final");
  const summarySnapshots = completed.length ? completed : snapshots;
  const avg = (field) => summarySnapshots.reduce((total, snapshot) => total + Number(snapshot[field] || 0), 0) / summarySnapshots.length;
  const total = (field) => summarySnapshots.reduce((sum, snapshot) => sum + Number(snapshot[field] || 0), 0);
  return [
    historyMetric("Snapshots", String(snapshots.length), completed.length ? "Month-to-date and completed" : "Month-to-date only"),
    historyMetric("Average Cash End", money(avg("cashFlowProjected")), "Month-end projection"),
    historyMetric("Average Expenses Actual", money(avg("expensesActual")), "Actual expenses average"),
    historyMetric("Average Misc. Actual", money(avg("miscellaneousActual")), "Calculated actual miscellaneous"),
    historyMetric("Average Balance Diff.", money(avg("balanceDifference")), "Should stay near zero"),
    historyMetric("Cards Net Difference", money(total("creditCardDifference")), "Payments minus card purchases"),
  ];
}

function historyMetric(label, value, detail) {
  return `<article class="history-metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function createHistorySnapshot(kind = "mtd") {
  const model = projectionAnalysisModel(state);
  const p = model.projection;
  const snapshotKind = kind === "final" ? "final" : "mtd";
  const generatedDate = localDateValue();
  return {
    id: `history-${snapshotKind}-${state.month}`,
    kind: snapshotKind,
    label: snapshotKind === "mtd" ? "Month-to-date" : "Completed month",
    generatedDate,
    month: state.month,
    year: Number(String(state.month).slice(0, 4)) || new Date().getFullYear(),
    savedAt: new Date().toISOString(),
    availableBudget: p.budgetAvailableForExpenses,
    availableActual: p.actualAvailableForExpenses,
    availableProjected: p.projectedAvailableForExpenses,
    expensesBudget: p.totalExpensesBudget,
    expensesActual: p.totalActualExpenses,
    expensesProjected: p.totalProjectedExpenses,
    cashFlowInitial: Number(state.initialCashFlow || 0),
    cashFlowActual: Number(state.currentCashFlow || 0),
    cashFlowProjected: p.expectedEndCashFlow,
    savingsBudget: Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0),
    savingsActual: Number(state.currentSavings || 0),
    savingsProjected: p.projectedSavings,
    creditCardPayments: model.creditCardRow.payments,
    creditCardExpenses: model.creditCardRow.expenses,
    creditCardDifference: model.creditCardRow.difference,
    miscellaneousActual: p.miscellaneousActual,
    balanceDifference: totalBalanceDifference(p),
    evaluation: model.expenseTotalRow.evaluation.label,
    concepts: historyActualConceptValues(model),
  };
}

function historySnapshotSort(a, b) {
  const monthCompare = String(a.month).localeCompare(String(b.month));
  if (monthCompare) return monthCompare;
  return historySnapshotKind(a) === historySnapshotKind(b) ? 0 : historySnapshotKind(a) === "mtd" ? -1 : 1;
}

function historySnapshotKind(snapshot) {
  return snapshot.kind === "mtd" ? "mtd" : "final";
}

function historySnapshotHeader(snapshot) {
  const label = historySnapshotKind(snapshot) === "mtd" ? "MTD" : "Final";
  const date = displayShortDate(snapshot.generatedDate || snapshot.savedAt);
  return `<small>${date}</small><span>${monthShort(snapshot.month)} ${label}</span>`;
}

function historySnapshotTitle(snapshot) {
  const label = historySnapshotKind(snapshot) === "mtd" ? "MTD" : "Final";
  const date = displayShortDate(snapshot.generatedDate || snapshot.savedAt);
  return `${monthShort(snapshot.month)} ${label}${date ? ` ${date}` : ""}`;
}

function displayShortDate(value) {
  if (!value) return "";
  const date = new Date(String(value).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function historyConceptRows() {
  const current = historyCurrentConceptValues();
  return [
    { key: "available-income", label: "Available Income", budget: current.budget["available-income"], projected: current.projected["available-income"] },
    { key: "cash-flow", label: "Cash Flow", budget: current.budget["cash-flow"], projected: current.projected["cash-flow"] },
    { key: "savings", label: "Savings", budget: current.budget.savings, projected: current.projected.savings },
    { key: "ref-1", label: "Mortgage Payment or Home Rent", budget: current.budget["ref-1"], projected: current.projected["ref-1"] },
    { key: "ref-2", label: "Credit Cards", budget: current.budget["ref-2"], projected: current.projected["ref-2"] },
    { key: "ref-3", label: "Auto, Personal, Loans, Commercial Credit and Other", budget: current.budget["ref-3"], projected: current.projected["ref-3"] },
    { key: "ref-4", label: "Food and Regular Home Purchases", budget: current.budget["ref-4"], projected: current.projected["ref-4"] },
    { key: "ref-5", label: "General Home Services", budget: current.budget["ref-5"], projected: current.projected["ref-5"] },
    { key: "ref-6", label: "Communications, Internet, Telephones and Subscriptions", budget: current.budget["ref-6"], projected: current.projected["ref-6"] },
    { key: "ref-7", label: "Auto Gas Transportation and Similar", budget: current.budget["ref-7"], projected: current.projected["ref-7"] },
    { key: "ref-8", label: "Personal Expenses and Various", budget: current.budget["ref-8"], projected: current.projected["ref-8"] },
    { key: "ref-9", label: "Education General Expense and Fees", budget: current.budget["ref-9"], projected: current.projected["ref-9"] },
    { key: "ref-10", label: "Health, Medicines, Fees and Similar", budget: current.budget["ref-10"], projected: current.projected["ref-10"] },
    { key: "ref-11", label: "Fun, Entertainment, Restaurant and Other", budget: current.budget["ref-11"], projected: current.projected["ref-11"] },
    { key: "ref-12", label: "Other Various Expenses", budget: current.budget["ref-12"], projected: current.projected["ref-12"] },
    { key: "ref-13", label: "Provision for Unforeseen or Scheduled Expenses", budget: current.budget["ref-13"], projected: current.projected["ref-13"] },
    { key: "ref-14", label: "Miscellaneous no Register Expenses", budget: current.budget["ref-14"], projected: current.projected["ref-14"] },
    { key: "cc-payments", label: "Credit card Payments", budget: current.budget["cc-payments"], projected: current.projected["cc-payments"] },
    { key: "cc-expenses", label: "Credit card Expenses", budget: current.budget["cc-expenses"], projected: current.projected["cc-expenses"] },
  ];
}

function historyConceptRow(row, snapshots) {
  const values = snapshots.map((snapshot) => historySnapshotConceptValue(snapshot, row.key));
  const average = values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  return `<tr>
    <td><strong>${row.label}</strong></td>
    <td>${money(row.budget)}</td>
    <td>${money(row.projected)}</td>
    <td>${money(average)}</td>
    ${values.map((value) => `<td>${money(value)}</td>`).join("")}
  </tr>`;
}

function historySnapshotConceptValue(snapshot, key) {
  if (snapshot.concepts && Object.prototype.hasOwnProperty.call(snapshot.concepts, key)) {
    return Number(snapshot.concepts[key] || 0);
  }
  if (key === "available-income") return Number(snapshot.availableActual || 0);
  return 0;
}

function historyActualConceptValues(model = projectionAnalysisModel(state)) {
  const values = {
    "available-income": model.projection.actualAvailableForExpenses,
    "cash-flow": Number(state.currentCashFlow || 0),
    savings: Number(state.currentSavings || 0),
    "ref-14": model.projection.miscellaneousActual,
    "cc-payments": model.creditCardRow.payments,
    "cc-expenses": model.creditCardRow.expenses,
  };
  for (let ref = 1; ref <= 13; ref += 1) {
    values[`ref-${ref}`] = state.expenses
      .filter((line) => String(line.reference) === String(ref))
      .reduce((total, line) => total + transactionTotalForConcept(line.id), 0);
  }
  return values;
}

function historyCurrentConceptValues() {
  const model = projectionAnalysisModel(state);
  const budget = {
    "available-income": model.projection.budgetAvailableForExpenses,
    "cash-flow": Number(state.desiredFinalCashFlow || 0),
    savings: Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0),
    "ref-14": model.projection.miscellaneous,
    "cc-payments": model.creditCardRow.payments,
    "cc-expenses": model.creditCardRow.expenses,
  };
  const projected = {
    "available-income": model.projection.projectedAvailableForExpenses,
    "cash-flow": model.projection.expectedEndCashFlow,
    savings: model.projection.projectedSavings,
    "ref-14": model.projection.miscellaneousProjected,
    "cc-payments": model.creditCardRow.payments,
    "cc-expenses": model.creditCardRow.expenses,
  };
  for (let ref = 1; ref <= 13; ref += 1) {
    const lines = state.expenses.filter((line) => String(line.reference) === String(ref));
    const budgetTotal = lines.reduce((total, line) => total + Number(line.amount || 0), 0);
    const actualTotal = lines.reduce((total, line) => total + transactionTotalForConcept(line.id), 0);
    budget[`ref-${ref}`] = budgetTotal;
    projected[`ref-${ref}`] = Math.max(budgetTotal, actualTotal);
  }
  return { budget, projected };
}

function transactionTotalForConcept(conceptId) {
  return state.transactions
    .filter((tx) => tx.conceptId === conceptId)
    .reduce((total, tx) => total + Number(tx.amount || 0), 0);
}

function monthShort(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleString("en-US", { month: "short" }).toUpperCase();
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
    ${actionSuggestionPanel(p, "evaluation")}
  `;
}

function actionSuggestionPanel(p, context) {
  const suggestions = actionSuggestions(p, context);
  const title = context === "dashboard" ? "Results Comments and Suggested Corrections" : "Suggested Corrections";
  return `<section class="panel action-suggestions action-suggestions-${context}">
    <h2>${title}</h2>
    <p class="muted">Review these suggested corrections during the month to adjust values and finish with positive cash flow.</p>
    <ul>${suggestions.map((item) => `<li class="suggestion-${item.level}"><strong>${item.title}</strong><span>${item.text}</span></li>`).join("")}</ul>
  </section>`;
}

function actionSuggestions(p, context) {
  const suggestions = [];
  const projectedExpenseGap = p.totalProjectedExpenses - p.totalExpensesBudget;
  const cardGap = p.creditCardActual - p.creditCardPaymentsActual;
  const targetSavings = Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0);

  if (Number(p.miscellaneousActualRaw || 0) < 0) {
    suggestions.push({
      level: "problem",
      title: "Correct missing actual data",
      text: `Actual miscellaneous is ${money(p.miscellaneousActualRaw)}. Review current Cash Flow, Savings, income deposits, card purchases, and payments before using the projection.`,
    });
  }

  if (p.expectedEndCashFlow < 0) {
    suggestions.push({
      level: "problem",
      title: "Recover cash flow",
      text: `Projected cash flow is ${money(p.expectedEndCashFlow)}. Reduce discretionary spending first; use savings only for crisis payments that cannot be delayed.`,
    });
  } else if (p.expectedEndCashFlow < 300) {
    suggestions.push({
      level: "watch",
      title: "Protect cash flow",
      text: `Projected cash flow is tight at ${money(p.expectedEndCashFlow)}. Hold new purchases until payments due this month are covered.`,
    });
  }

  if (projectedExpenseGap > 0) {
    suggestions.push({
      level: "problem",
      title: "Adjust expenses",
      text: `Projected expenses are ${money(projectedExpenseGap)} above budget. Lower variable categories or move due dates before increasing miscellaneous.`,
    });
  }

  if (p.miscellaneousProjected > p.miscellaneous * 1.1) {
    suggestions.push({
      level: "watch",
      title: "Control miscellaneous",
      text: `Based on the current spending trend, miscellaneous is projected at ${money(p.miscellaneousProjected)} by month end. Control the daily pace to reduce the final total.`,
    });
  }

  if (cardGap > 0) {
    suggestions.push({
      level: "watch",
      title: "Review credit cards",
      text: `Credit card spending is increasing debt by ${money(cardGap)}. Add a card payment, reduce new card use, or identify the card activity in comments.`,
    });
  } else if (p.expectedEndCashFlow < 0 && p.creditCardPlanned > 0) {
    suggestions.push({
      level: "watch",
      title: "Use credit only for cash crisis",
      text: `Cards can temporarily protect cash flow up to ${money(p.creditCardPlanned)}, but track each card purchase and plan the payment before adding new debt.`,
    });
  }

  if (p.creditCardOverdraft > 0) {
    suggestions.push({
      level: "problem",
      title: "Reduce card dependence",
      text: `The budget needs ${money(p.creditCardOverdraft)} of card coverage. Reduce controlled expenses or add income before relying on credit.`,
    });
  }

  if (p.projectedSavings < targetSavings) {
    suggestions.push({
      level: "watch",
      title: "Rebuild savings",
      text: "Savings are below the planned path. Restore the deposit when cash flow is stable, or temporarily lower the savings budget and rebalance expenses.",
    });
  }

  if (p.debtToIncome > 0.43) {
    suggestions.push({
      level: "problem",
      title: "Lower debt pressure",
      text: "Committed debts are above the recommended range. Consider rescheduling payments, reducing optional debt, or increasing income before adding new expenses.",
    });
  } else if (p.debtToIncome > 0.35) {
    suggestions.push({
      level: "watch",
      title: "Watch committed debts",
      text: "Debt pressure is near the warning range. Avoid adding fixed payments until the monthly projection improves.",
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      level: "good",
      title: "Stay on plan",
      text: "The projection is balanced. Keep updating transactions and balances so the plan can react before cash flow turns negative.",
    });
  }

  if (context === "evaluation") {
    suggestions.push({
      level: "good",
      title: "Rebalance with the Smart Model",
      text: "Use the group ranges above to move money from high-pressure groups into cash flow, savings, or overdue payments.",
    });
  }

  return suggestions.slice(0, context === "dashboard" ? 4 : 6);
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

function smartHelpPage(p) {
  const quickQuestions = helpQuickQuestions();
  return `
    <section class="panel help-panel">
      <div class="help-intro">
        <div>
          <p class="eyebrow">${helpText("eyebrow")}</p>
          <h2>Smart Help Chat</h2>
          <p class="muted">${helpText("intro")}</p>
        </div>
        <span class="help-scope">${helpText("scope")}</span>
      </div>
      <div class="help-chat" aria-live="polite">
        ${helpMessages.map(helpMessageBubble).join("")}
      </div>
      <div class="help-start-guide">
        <div>
          <strong>${helpText("startGuideTitle")}</strong>
          <span>${helpText("startGuideText")}</span>
        </div>
        <button class="primary" type="button" data-start-guide>${helpText("startGuideButton")}</button>
      </div>
      <form id="help-form" class="help-form">
        <input name="question" autocomplete="off" placeholder="${helpText("placeholder")}" />
        <button type="submit">${helpText("ask")}</button>
      </form>
      <div class="help-actions">
        <button class="secondary" type="button" data-clear-help-chat>${helpText("clear")}</button>
      </div>
      <div class="help-quick">
        ${quickQuestions.map((question) => `<button class="secondary" type="button" data-help-question="${escapeHtml(question)}">${question}</button>`).join("")}
      </div>
      <p class="help-disclaimer">${helpText("disclaimer")}</p>
    </section>
    <section class="panel help-current">
      <h2>${helpText("signalsTitle")}</h2>
      <ul>${smartHelpSignals(p).map((signal) => `<li class="suggestion-${signal.level}"><strong>${signal.title}</strong><span>${signal.text}</span></li>`).join("")}</ul>
    </section>
  `;
}

function helpMessageBubble(message) {
  return `<article class="help-message help-${message.role}">
    <span>${message.role === "user" ? helpText("you") : "Smart Help Chat"}</span>
    <p>${escapeHtml(message.text)}</p>
  </article>`;
}

function helpLanguage() {
  return state.language === "es" ? "es" : "en";
}

function helpText(key) {
  const labels = {
    en: {
      initialMessage:
        "Ask me about this monthly budget: cash flow, savings, cards, miscellaneous, balance mismatch, transactions, projections, Ref numbers, priorities, or starting a new month.",
      eyebrow: "Budget support chat",
      intro: "Ask short questions about this monthly budget. Answers are based only on the values entered in this system.",
      scope: "Budget guidance only",
      placeholder: "Ask about cash flow, savings, cards, miscellaneous, or balance mismatch",
      ask: "Ask",
      clear: "Clear chat",
      startGuideTitle: "New user?",
      startGuideText: "Use a short guided flow to learn the first steps.",
      startGuideButton: "Start Guide",
      disclaimer:
        "Smart Help Chat explains this budget and its projections. It does not replace financial, tax, legal, credit, or investment advice.",
      signalsTitle: "Current budget signals",
      you: "You",
    },
    es: {
      initialMessage:
        "Preguntame sobre este presupuesto mensual: flujo de efectivo, ahorros, tarjetas, miscelaneos, desbalance, transacciones, proyecciones, numeros Ref, prioridades o nuevo mes.",
      eyebrow: "Chat de apoyo del presupuesto",
      intro: "Haz preguntas cortas sobre este presupuesto mensual. Las respuestas se basan solo en los valores ingresados en este sistema.",
      scope: "Solo guia de presupuesto",
      placeholder: "Pregunta sobre flujo, ahorros, tarjetas, miscelaneos o desbalance",
      ask: "Preguntar",
      clear: "Borrar chat",
      startGuideTitle: "Usuario nuevo?",
      startGuideText: "Usa una guia corta para aprender los primeros pasos.",
      startGuideButton: "Iniciar guia",
      disclaimer:
        "Smart Help Chat explica este presupuesto y sus proyecciones. No reemplaza asesoria financiera, fiscal, legal, crediticia ni de inversion.",
      signalsTitle: "Senales actuales del presupuesto",
      you: "Tu",
    },
  };
  return labels[helpLanguage()][key] || labels.en[key] || "";
}

function helpQuickQuestions() {
  const questions = {
    en: [
      "Why is Miscellaneous Actual negative?",
      "Why does Savings Projected not show the deposit?",
      "What does Balance mismatch mean?",
      "What should I review if Cash Flow is negative?",
      "How do credit card purchases affect the budget?",
      "What do I need to focus on?",
      "What does Ref mean?",
      "Show me the first steps",
      "How do I start a new month?",
    ],
    es: [
      "Por que Miscelaneos Actual esta negativo?",
      "Por que Ahorros Proyectado no muestra el deposito?",
      "Que significa desbalance?",
      "Que reviso si el flujo de efectivo es negativo?",
      "Como afectan las compras con tarjeta al presupuesto?",
      "En que debo enfocarme?",
      "Que significa Ref?",
      "Muestrame los primeros pasos",
      "Como inicio un nuevo mes?",
    ],
  };
  return questions[helpLanguage()];
}

function answerHelpQuestion(question, p) {
  const normalized = normalizeText(question);
  if (/\b(ref|reference|referencia)\b/.test(normalized)) {
    return smartHelpReferenceAnswer();
  }
  const topics = smartHelpTopics(p);
  const scored = topics
    .map((topic) => ({
      ...topic,
      score: topic.keywords.reduce((total, keyword) => {
        const normalizedKeyword = normalizeText(keyword);
        const words = normalizedKeyword.split(" ").filter(Boolean);
        if (normalized.includes(normalizedKeyword)) return total + Math.max(2, words.length);
        return total + words.filter((word) => normalized.includes(word)).length;
      }, 0),
    }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score > 0) return scored[0].answer;
  return helpLanguage() === "es"
    ? "No encontre una coincidencia exacta. Intenta preguntar sobre flujo de efectivo, ahorros, tarjetas, miscelaneos, desbalance, transacciones, proyeccion, pagos vencidos, Ref o nuevo mes."
    : "I did not find an exact match. Try asking about cash flow, savings, credit cards, miscellaneous, balance mismatch, transactions, projection, overdue payments, Ref, or new month.";
}

function smartHelpTopics(p) {
  const balanceGap = Math.abs(Number(p.actualBalanceDifference || 0)) + Math.abs(Number(p.projectedBalanceDifference || 0));
  return [
    {
      keywords: ["start guide", "first steps", "start using", "how do i start", "what should i enter first", "new user", "primeros pasos", "como empiezo", "como iniciar", "usuario nuevo", "que debo ingresar primero", "guia"],
      answer: smartHelpStartGuideAnswer(),
    },
    {
      keywords: ["focus", "improve", "priority", "priorities", "review first", "what do i need", "where should i start", "mejorar", "enfocar", "prioridad", "prioridades", "que reviso", "que debo revisar"],
      answer: smartHelpFocusAnswer(p),
    },
    {
      keywords: ["ref", "reference", "reference number", "number refer", "numero referencia", "referencia", "grupo", "comparative group", "grupo comparativo"],
      answer: smartHelpReferenceAnswer(),
    },
    {
      keywords: ["miscellaneous", "miscelaneo", "miscelaneos", "misc", "negative", "negativo"],
      answer:
        Number(p.miscellaneousActualRaw || 0) < 0
          ? bilingual(
              `Actual Miscellaneous is ${money(p.miscellaneousActualRaw)}. That usually means missing actual data: update Cash Flow, Savings, income deposits, credit card purchases, or credit card payments before using the projection.`,
              `Miscelaneos Actual es ${money(p.miscellaneousActualRaw)}. Normalmente significa que faltan datos actuales: actualiza Flujo de Efectivo, Ahorros, depositos de ingresos, compras con tarjeta o pagos de tarjeta antes de usar la proyeccion.`,
            )
          : bilingual(
              `Miscellaneous is calculated by the system from the budget and actual activity. It is not entered as a transaction. Projected Miscellaneous is now ${money(p.miscellaneousProjected)}.`,
              `Miscelaneos es calculado por el sistema con base en el presupuesto y la actividad actual. No se registra como transaccion. Miscelaneos Proyectado ahora es ${money(p.miscellaneousProjected)}.`,
            ),
    },
    {
      keywords: ["saving", "savings", "ahorro", "ahorros", "deposit", "deposito"],
      answer:
        p.projectedSavings < Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0)
          ? bilingual(
              `Savings Projected is ${money(p.projectedSavings)} because the deposit date passed and the current Savings balance does not show the planned deposit. Remaining savings is ${money(Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0) - Number(state.currentSavings || 0))}.`,
              `Ahorros Proyectado es ${money(p.projectedSavings)} porque la fecha de deposito ya paso y el balance actual de Ahorros no muestra el deposito planeado. Ahorro restante es ${money(Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0) - Number(state.currentSavings || 0))}.`,
            )
          : bilingual(
              `Savings Projected is ${money(p.projectedSavings)}. Savings are controlled by the balance entered in Update Transactions, not by registering savings as income.`,
              `Ahorros Proyectado es ${money(p.projectedSavings)}. Los ahorros se controlan con el balance ingresado en Update Transactions, no registrando ahorros como ingreso.`,
            ),
    },
    {
      keywords: ["cash", "flow", "flujo", "efectivo", "negative", "negativo"],
      answer:
        p.expectedEndCashFlow < 0
          ? bilingual(
              `Projected Cash Flow is ${money(p.expectedEndCashFlow)}. Review missing transactions first; then reduce variable expenses, delay noncritical spending, or use savings only if this budget is in cash crisis.`,
              `Flujo de Efectivo Proyectado es ${money(p.expectedEndCashFlow)}. Primero revisa transacciones faltantes; despues reduce gastos variables, retrasa gastos no criticos o usa ahorros solo si este presupuesto esta en crisis de efectivo.`,
            )
          : bilingual(
              `Projected Cash Flow is ${money(p.expectedEndCashFlow)}. Keep updating current Cash Flow and transactions so the projection remains reliable.`,
              `Flujo de Efectivo Proyectado es ${money(p.expectedEndCashFlow)}. Mantiene actualizado el flujo actual y las transacciones para que la proyeccion sea confiable.`,
            ),
    },
    {
      keywords: ["balance", "mismatch", "desbalance", "diferencia", "check", "cuadra", "coincide"],
      answer:
        balanceGap > 0.01
          ? bilingual(
              "There is a balance mismatch. Available Income and Total Expenses must match in Budget, Actual, and Projection. Use Synchronize and recalculate; if it remains, review balances, income, expenses, cards, and negative Miscellaneous.",
              "Hay un desbalance. Ingresos Disponibles y Gastos Totales deben coincidir en Presupuesto, Actual y Proyeccion. Usa Synchronize and recalculate; si continua, revisa balances, ingresos, gastos, tarjetas y Miscelaneos negativo.",
            )
          : bilingual(
              "Balance check is currently aligned. That means Available Income and Total Expenses match based on the values entered.",
              "La revision de balance esta alineada. Eso significa que Ingresos Disponibles y Gastos Totales coinciden con base en los valores ingresados.",
            ),
    },
    {
      keywords: ["credit", "card", "cards", "tarjeta", "tarjetas", "credito", "payment", "pago"],
      answer:
        p.creditCardActual > p.creditCardPaymentsActual
          ? bilingual(
              `Credit card purchases exceed card payments by ${money(p.creditCardActual - p.creditCardPaymentsActual)}. This increases card debt and can change available income, expenses, and cash flow projection.`,
              `Las compras con tarjeta exceden los pagos de tarjeta por ${money(p.creditCardActual - p.creditCardPaymentsActual)}. Esto aumenta la deuda de tarjetas y puede cambiar ingresos disponibles, gastos y proyeccion de flujo.`,
            )
          : bilingual(
              `Credit card payments are ${money(p.creditCardPaymentsActual)} and card purchases are ${money(p.creditCardActual)}. Card activity should be entered correctly as card purchases or payments, with details in comments if needed.`,
              `Los pagos de tarjeta son ${money(p.creditCardPaymentsActual)} y las compras con tarjeta son ${money(p.creditCardActual)}. La actividad de tarjetas debe registrarse correctamente como compras o pagos, usando comentarios si necesitas detalle.`,
            ),
    },
    {
      keywords: ["transaction", "transactions", "movimiento", "movimientos", "actual", "actuales", "update"],
      answer: bilingual(
        "Update Transactions should include actual income deposits, budgeted expense payments, credit card purchases, and card payments. Savings are not entered as transactions; they are controlled by the Savings balance.",
        "Update Transactions debe incluir depositos reales de ingresos, pagos de gastos presupuestados, compras con tarjeta y pagos de tarjeta. Los ahorros no se ingresan como transacciones; se controlan con el balance de Ahorros.",
      ),
    },
    {
      keywords: ["projection", "proyeccion", "projected", "forecast", "future", "futuro"],
      answer: bilingual(
        `Projection estimates month-end results from the entered budget, actual transactions, balances, card activity, and remaining days. Current projected expenses are ${money(p.totalProjectedExpenses)} and projected available income is ${money(p.projectedAvailableForExpenses)}.`,
        `La proyeccion estima el resultado de fin de mes usando el presupuesto ingresado, transacciones actuales, balances, actividad de tarjetas y dias restantes. Los gastos proyectados actuales son ${money(p.totalProjectedExpenses)} y el ingreso disponible proyectado es ${money(p.projectedAvailableForExpenses)}.`,
      ),
    },
    {
      keywords: ["overdue", "late", "vencido", "vencidos", "future", "futuro", "payments", "pagos"],
      answer: bilingual(
        "Payment Timing separates overdue committed payments from future committed payments. Use it to decide what must be paid first before relying on remaining cash flow.",
        "Payment Timing separa pagos comprometidos vencidos de pagos comprometidos futuros. Usalo para decidir que debe pagarse primero antes de confiar en el flujo restante.",
      ),
    },
    {
      keywords: ["new", "month", "mes", "nuevo", "reset", "borrar", "clear"],
      answer: bilingual(
        "Use New month: reset actuals only when starting a new month. It clears current transactions and actual balances, but it keeps the budget setup so you can enter new month actual data.",
        "Usa New month: reset actuals only al iniciar un nuevo mes. Borra transacciones y balances actuales, pero mantiene el presupuesto para que ingreses los datos actuales del nuevo mes.",
      ),
    },
    {
      keywords: ["smart", "model", "modelo", "evaluation", "evaluacion"],
      answer: bilingual(
        "Smart Model compares this budget distribution with a reference model. It helps identify groups that may be too high or too low, but it is only based on this monthly budget data.",
        "Smart Model compara la distribucion de este presupuesto con un modelo de referencia. Ayuda a identificar grupos altos o bajos, pero se basa solo en los datos de este presupuesto mensual.",
      ),
    },
    {
      keywords: ["help", "ayuda", "how", "como", "explain", "explica", "meaning", "significa"],
      answer: bilingual(
        "Ask about one budget topic at a time, for example: cash flow, savings, credit cards, miscellaneous, balance mismatch, projection, transactions, overdue payments, Ref, or new month.",
        "Pregunta sobre un tema del presupuesto a la vez, por ejemplo: flujo de efectivo, ahorros, tarjetas, miscelaneos, desbalance, proyeccion, transacciones, pagos vencidos, Ref o nuevo mes.",
      ),
    },
  ];
}

function smartHelpReferenceAnswer() {
  return bilingual(
    "Ref is the comparative budget group number. It links each budget concept to Smart Model groups, so the system can compare your budget distribution with the reference model. In some sections the Ref is fixed, such as Other Debts = 3 and Miscellaneous = 14.",
    "Ref es el numero de grupo comparativo del presupuesto. Conecta cada concepto con los grupos de Smart Model para comparar la distribucion del presupuesto con el modelo de referencia. En algunas secciones el Ref es fijo, por ejemplo Other Debts = 3 y Miscellaneous = 14.",
  );
}

function smartHelpStartGuideAnswer() {
  return bilingual(
    [
      "Start with these steps:",
      "1. Budget Setup: enter monthly income, initial cash flow, planned savings, expense concepts, due days, and credit card budget.",
      "2. Update Transactions: enter current Cash Flow, current Savings, actual income deposits, expense payments, card purchases, and card payments.",
      "3. Projection Analysis: confirm Available Income and Total Expenses match in Budget, Actual, and Projected.",
      "4. Review alerts: fix balance mismatch, negative Actual Miscellaneous, cash flow risk, overdue payments, or missed savings deposit.",
      "5. Use Smart Help Chat during the month when a number does not make sense.",
      "6. New month: use New month: reset actuals only, then enter the new actual balances and movements.",
    ].join("\n"),
    [
      "Empieza con estos pasos:",
      "1. Budget Setup: ingresa ingresos mensuales, flujo inicial, ahorro planeado, conceptos de gastos, dias de vencimiento y presupuesto de tarjetas.",
      "2. Update Transactions: ingresa Cash Flow actual, Savings actual, depositos de ingresos, pagos de gastos, compras con tarjeta y pagos de tarjeta.",
      "3. Projection Analysis: confirma que Available Income y Total Expenses coincidan en Budget, Actual y Projected.",
      "4. Revisa alertas: corrige desbalance, Miscelaneos Actual negativo, riesgo de flujo, pagos vencidos o ahorro no depositado.",
      "5. Usa Smart Help Chat durante el mes cuando un numero no tenga sentido.",
      "6. Nuevo mes: usa New month: reset actuals only, despues ingresa los nuevos balances y movimientos actuales.",
    ].join("\n"),
  );
}

function smartHelpFocusAnswer(p) {
  const priorities = [];
  if (Number(p.miscellaneousActualRaw || 0) < 0) {
    priorities.push(
      bilingual(
        "correct missing actual data because Actual Miscellaneous is negative",
        "corrige datos actuales faltantes porque Miscelaneos Actual esta negativo",
      ),
    );
  }
  if (Math.abs(Number(p.actualBalanceDifference || 0)) > 0.01 || Math.abs(Number(p.projectedBalanceDifference || 0)) > 0.01) {
    priorities.push(
      bilingual(
        "fix the balance mismatch so Available Income and Total Expenses match",
        "corrige el desbalance para que Ingresos Disponibles y Gastos Totales coincidan",
      ),
    );
  }
  if (p.expectedEndCashFlow < 0) {
    priorities.push(
      bilingual(
        `protect Cash Flow because the projection is ${money(p.expectedEndCashFlow)}`,
        `protege el Flujo de Efectivo porque la proyeccion es ${money(p.expectedEndCashFlow)}`,
      ),
    );
  }
  if (p.projectedSavings < Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0)) {
    priorities.push(
      bilingual(
        "review Savings because the planned deposit is not reflected in the balance",
        "revisa Ahorros porque el deposito planeado no aparece reflejado en el balance",
      ),
    );
  }
  if (p.creditCardActual > p.creditCardPaymentsActual) {
    priorities.push(
      bilingual(
        "review credit card activity because purchases are higher than payments",
        "revisa tarjetas porque las compras son mayores que los pagos",
      ),
    );
  }
  if (!priorities.length) {
    return bilingual(
      "Focus on keeping the budget updated: enter actual income, expenses, card activity, Cash Flow, and Savings. Right now there are no critical alerts in the main checks.",
      "Enfocate en mantener actualizado el presupuesto: ingresa ingresos actuales, gastos, actividad de tarjetas, Flujo de Efectivo y Ahorros. Ahora no hay alertas criticas en las revisiones principales.",
    );
  }
  return bilingual(
    `Focus first on: ${priorities.slice(0, 3).join("; ")}. After correcting those, use Synchronize and recalculate to refresh the projection.`,
    `Enfocate primero en: ${priorities.slice(0, 3).join("; ")}. Despues de corregirlo, usa Synchronize and recalculate para actualizar la proyeccion.`,
  );
}

function smartHelpSignals(p) {
  const signals = [];
  if (Number(p.miscellaneousActualRaw || 0) < 0) {
    signals.push({
      level: "problem",
      title: bilingual("Missing actual data", "Faltan datos actuales"),
      text: bilingual(
        "Actual Miscellaneous is negative; review balances and transactions before decisions.",
        "Miscelaneos Actual esta negativo; revisa balances y transacciones antes de tomar decisiones.",
      ),
    });
  }
  if (Math.abs(Number(p.actualBalanceDifference || 0)) > 0.01 || Math.abs(Number(p.projectedBalanceDifference || 0)) > 0.01) {
    signals.push({
      level: "problem",
      title: bilingual("Balance mismatch", "Desbalance"),
      text: bilingual(
        "Available Income and Total Expenses do not match yet.",
        "Ingresos Disponibles y Gastos Totales todavia no coinciden.",
      ),
    });
  }
  if (p.expectedEndCashFlow < 0) {
    signals.push({
      level: "problem",
      title: bilingual("Cash flow risk", "Riesgo en flujo de efectivo"),
      text: bilingual(
        `Projected Cash Flow is ${money(p.expectedEndCashFlow)}.`,
        `Flujo de Efectivo Proyectado es ${money(p.expectedEndCashFlow)}.`,
      ),
    });
  }
  if (p.projectedSavings < Number(state.initialSavings || 0) + Number(state.budgetedSavings || 0)) {
    signals.push({
      level: "watch",
      title: bilingual("Savings not completed", "Ahorro no completado"),
      text: bilingual(
        "The planned savings deposit is not reflected in the current balance.",
        "El deposito de ahorro planeado no esta reflejado en el balance actual.",
      ),
    });
  }
  if (!signals.length) {
    signals.push({
      level: "good",
      title: bilingual("No critical help alerts", "Sin alertas criticas"),
      text: bilingual(
        "The main budget checks are aligned with the values entered.",
        "Las revisiones principales del presupuesto estan alineadas con los valores ingresados.",
      ),
    });
  }
  return signals.slice(0, 4);
}

function bilingual(en, es) {
  return helpLanguage() === "es" ? es : en;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    <section class="panel">
      <h2>Terms and Conditions</h2>
      <p class="muted">Current terms version: ${TERMS_VERSION}. ${termsAccepted() ? `Accepted on ${new Date(state.termsAcceptedAt || Date.now()).toLocaleString("en-US")}.` : "Acceptance is required before using Smart Budget."}</p>
      <button class="secondary" type="button" data-view-terms>View Terms and Conditions</button>
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
      setPage(button.dataset.page);
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
    state = clearActualMonthState(state);
    saveState(state);
    render();
  });
  document.querySelectorAll("[data-reconcile-data]").forEach((button) => {
    button.addEventListener("click", () => {
      state = reconcileState(state);
      state.dataNotice = `Saved data synchronized and recalculated on ${new Date().toLocaleString("en-US")}. If numbers still differ, reset actual month data and re-enter balances and transactions.`;
      saveState(state);
      render();
    });
  });
  document.querySelectorAll("[data-clear-actual-month]").forEach((button) => {
    button.addEventListener("click", () => {
      state = clearActualMonthState(state);
      saveState(state);
      render();
    });
  });
  document.querySelectorAll("[data-actual-balance]").forEach((input) => {
    input.addEventListener("input", () => {
      state[input.dataset.actualBalance] = Number(input.value);
      state.dataNotice = "";
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
    state.dataNotice = "";
    state.transactions.unshift({ id: crypto.randomUUID(), ...data, amount: Number(data.amount) });
    state.lastActualUpdate = localDateValue();
    saveState(state);
    render();
  });
  document.querySelector("#help-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitHelpQuestion(new FormData(event.target).get("question"));
  });
  document.querySelectorAll("[data-help-question]").forEach((button) => {
    button.addEventListener("click", () => submitHelpQuestion(button.dataset.helpQuestion));
  });
  document.querySelector("[data-start-guide]")?.addEventListener("click", () => {
    helpMessages = [
      ...helpMessages,
      { role: "assistant", text: smartHelpStartGuideAnswer() },
    ].slice(-10);
    render();
  });
  document.querySelector("[data-clear-help-chat]")?.addEventListener("click", () => {
    helpMessages = initialHelpMessages();
    render();
  });
  document.querySelector("[data-view-terms]")?.addEventListener("click", () => {
    showTermsModal = true;
    render();
  });
  document.querySelector("[data-close-terms]")?.addEventListener("click", () => {
    showTermsModal = false;
    render();
  });
  document.querySelector("[data-accept-terms]")?.addEventListener("click", () => {
    state.termsAcceptedVersion = TERMS_VERSION;
    state.termsAcceptedAt = new Date().toISOString();
    showTermsModal = false;
    saveState(state);
    render();
  });
  document.querySelector("[data-save-history-mtd]")?.addEventListener("click", () => {
    saveHistorySnapshot("mtd");
  });
  document.querySelector("[data-save-history-final]")?.addEventListener("click", () => {
    saveHistorySnapshot("final");
  });
  document.querySelectorAll("[data-remove-history-snapshot]").forEach((button) => {
    button.addEventListener("click", () => {
      state.historySnapshots = (state.historySnapshots || []).filter((item) => item.id !== button.dataset.removeHistorySnapshot);
      saveState(state);
      render();
    });
  });
  document.querySelector("#reset")?.addEventListener("click", () => {
    state = resetState();
    page = "budget";
    render();
  });
}

function saveHistorySnapshot(kind) {
  const snapshot = createHistorySnapshot(kind);
  state.historySnapshots = [
    ...(state.historySnapshots || []).filter((item) => !(item.month === snapshot.month && historySnapshotKind(item) === snapshot.kind)),
    snapshot,
  ];
  state.dataNotice = `${snapshot.label} history saved for ${snapshot.month}.`;
  saveState(state);
  render();
}

render();

function setPage(nextPage) {
  if (!validPages.includes(nextPage)) return;
  page = nextPage;
  const url = new URL(window.location.href);
  url.searchParams.set("page", nextPage);
  window.history.replaceState({}, "", url);
}

function submitHelpQuestion(value) {
  const question = String(value || "").trim();
  if (!question) return;
  const projection = dashboardModel(state).projection;
  helpMessages = [
    ...helpMessages,
    { role: "user", text: question },
    { role: "assistant", text: answerHelpQuestion(question, projection) },
  ].slice(-10);
  render();
}
