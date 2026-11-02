// Browser-only mock used by Playwright routes. Never imported by the application.
import { defaultState } from "/src/data/defaultState.js";
const options = window.__accessTestOptions || {};
const permanent = { allowed: true, reason: "ok", access_type: "COMMERCIAL", expires_at: null, remaining_seconds: null };
const user = { id: "first", email: "first@example.test" };
const makeState = (id) => ({ ...structuredClone(defaultState),
  termsAcceptedVersion: "2026-06-06-free-public", termsAcceptedAt: "2026-10-30T12:00:00Z",
  expenses: [{ id: "owned", concept: `Income ${id} <literal>`, amount: 250, dueDay: 15, group: "household", reference: "4" }],
  transactions: [{ id: "tx", conceptId: "owned", type: "expense", paymentMethod: "cash", date: "2026-11-01", amount: 25, comment: "Savings <keep literal>" }],
});
export const isSupabaseConfigured = !options.unconfigured;
const mock = window.__accessMock = {
  session: options.signedOut ? null : { user }, status: options.status || permanent,
  statusError: Boolean(options.statusError), budgetError: Boolean(options.budgetError),
  statusDelay: options.statusDelay || 0, budgetDelay: options.budgetDelay || 0,
  activationReason: options.activationReason || "activated", saveError: false,
  events: [], writes: [], callback: null,
  emit(id) {
    this.session = id ? { user: { id, email: `${id}@example.test` } } : null;
    this.callback?.(id ? "SIGNED_IN" : "SIGNED_OUT", this.session);
  },
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export const supabase = {
  auth: {
    async getSession() { mock.events.push("session"); return { data: { session: mock.session } }; },
    onAuthStateChange(callback) { mock.callback = callback; },
    async signOut() { mock.emit(null); return {}; },
    async signInWithPassword({ email }) {
      mock.session = { user: { id: "first", email } };
      return { data: { session: mock.session } };
    },
    async signUp(args) { mock.events.push({ signup: args.options }); return { data: { session: null } }; },
    async resetPasswordForEmail() { return {}; },
  },
  async rpc(name) {
    mock.events.push(name);
    if (name === "sb_access_status") {
      await delay(mock.statusDelay);
      return mock.statusError ? { error: { message: "offline" } } : { data: structuredClone(mock.status) };
    }
    if (name === "sb_activate_commercial") {
      if (mock.activationReason !== "activated") return { data: { activated: false, reason: mock.activationReason } };
      mock.status = permanent;
      return { data: { activated: true, reason: "activated" } };
    }
    throw new Error("Unexpected RPC");
  },
  from(table) {
    let id = mock.session?.user.id;
    const query = {
      select() { return this; }, eq(field, value) { if (field === "user_id") id = value; return this; }, limit() { return this; },
      async maybeSingle() {
        if (table === "budget_states") {
          mock.events.push(`budget:${id}`);
          const state = makeState(id);
          await delay(mock.budgetDelay);
          return mock.budgetError ? { error: { message: "denied" } } : { data: { state } };
        }
        return { data: null };
      },
      async upsert(data) {
        mock.events.push("save"); mock.writes.push(structuredClone(data));
        return mock.saveError ? { error: { message: "denied" } } : {};
      },
      async insert() { mock.events.push("terms"); return {}; },
    };
    return query;
  },
};
