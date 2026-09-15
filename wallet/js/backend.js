/* Supabase adapter.

   Implements the handful of calls auth.js and store.js need, over plain
   fetch against Supabase's REST endpoints — no SDK, no build step. Every
   method throws a plain Error with a readable message so the existing UI
   can surface it unchanged.

   When `config.supabase` is blank, `remote.enabled` is false and the app
   never reaches this module. */

import { config } from './config.js';

const base = () => config.supabase.url.replace(/\/+$/, '');
const key  = () => config.supabase.anonKey;

const headers = (token) => ({
  'Content-Type': 'application/json',
  apikey: key(),
  Authorization: `Bearer ${token || key()}`,
});

async function call(path, { method = 'GET', body, token, prefer } = {}) {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { ...headers(token), ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error_description || data?.msg || data?.message
      || `Request failed (${res.status}).`;
    throw new Error(message);
  }
  return data;
}

export const remote = {
  get enabled() { return Boolean(config.supabase.url && config.supabase.anonKey); },

  /** @returns {{token: string, refresh: string, userId: string, email: string}} */
  async signUp(email, password) {
    const d = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
    // Projects with email confirmation on return no session until confirmed.
    if (!d.access_token) throw new Error('Check your inbox to confirm the account, then sign in.');
    return session(d);
  },

  async signIn(email, password) {
    const d = await call('/auth/v1/token?grant_type=password',
      { method: 'POST', body: { email, password } });
    return session(d);
  },

  async refresh(refreshToken) {
    const d = await call('/auth/v1/token?grant_type=refresh_token',
      { method: 'POST', body: { refresh_token: refreshToken } });
    return session(d);
  },

  async signOut(token) {
    try { await call('/auth/v1/logout', { method: 'POST', token }); } catch { /* best effort */ }
  },

  /** The wallet row for the signed-in user, or null on a first run. */
  async loadWallet(token, userId) {
    const rows = await call(
      `/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&select=balance,txns,card`,
      { token });
    return rows?.[0] || null;
  },

  async saveWallet(token, userId, state) {
    await call('/rest/v1/wallets', {
      method: 'POST',
      token,
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: [{
        user_id: userId,
        balance: state.balance,
        txns: state.txns,
        card: state.card,
        updated_at: new Date().toISOString(),
      }],
    });
  },
};

const session = d => ({
  token: d.access_token,
  refresh: d.refresh_token,
  userId: d.user?.id,
  email: d.user?.email,
});
