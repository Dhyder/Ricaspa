// Replaces global fetch for calls to api.resend.com only. Everything else
// falls through to the real fetch (unused in this test, but kept safe).
// `mode` is mutable mid-test so a scenario can flip Resend from
// failing -> recovering to exercise the finalization-retry path.

export function installMockResend() {
  const state = { mode: "success", calls: [] };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (typeof url === "string" && url.includes("api.resend.com")) {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      state.calls.push({ to: body.to, subject: body.subject });

      if (state.mode === "fail") {
        return new Response("Resend 500: simulated outage", { status: 500 });
      }
      if (state.mode === "network-error") {
        throw new Error("simulated network failure reaching Resend");
      }
      return new Response(JSON.stringify({ id: "mock-email-" + state.calls.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(url, opts);
  };

  return {
    setMode(mode) {
      state.mode = mode;
    },
    calls: state.calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}
