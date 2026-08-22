// In-memory mock of a Cloudflare KV namespace binding. Ignores expirationTtl
// (irrelevant for a short-lived lifecycle test) but otherwise matches the
// get/put/delete surface that initiate-payment.js, payment-webhook.js,
// order-status.js and voucherCore.js call against env.VOUCHERS.

export function createMockKV() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    // Test-only introspection helpers — not part of the real KV API.
    _dump() {
      return Object.fromEntries(store.entries());
    },
    _has(key) {
      return store.has(key);
    },
  };
}
