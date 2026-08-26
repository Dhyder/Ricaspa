// Replaces global fetch for calls to challenges.cloudflare.com's Turnstile
// siteverify endpoint only. Chains to whatever fetch was installed before
// it (e.g. installMockResend), so both can be active at once — install
// this one first if you need both, and restore() in reverse order.

export function installMockTurnstile() {
  const state = { mode: "success", calls: [] };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (typeof url === "string" && url.includes("challenges.cloudflare.com/turnstile")) {
      const params = new URLSearchParams(opts?.body);
      state.calls.push({ token: params.get("response"), remoteip: params.get("remoteip") });

      if (state.mode === "success") {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (state.mode === "fail") {
        return new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      if (state.mode === "network-error") {
        throw new Error("simulated network failure reaching Cloudflare Turnstile");
      }
    }
    return originalFetch(url, opts);
  };

  return {
    setMode(mode) { state.mode = mode; },
    calls: state.calls,
    restore() { globalThis.fetch = originalFetch; },
  };
}
