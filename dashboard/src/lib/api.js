const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? JSON_HEADERS : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export const dashboardApi = {
  login: (passphrase) =>
    request("/api/dashboard-login", {
      method: "POST",
      body: JSON.stringify({ passphrase }),
    }),

  logout: () => request("/api/dashboard-logout", { method: "POST" }),

  stats: ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/api/dashboard-stats?${params.toString()}`);
  },

  bookings: ({ date, upcoming = false } = {}) => {
    const params = new URLSearchParams();
    if (upcoming) params.set("upcoming", "1");
    else if (date) params.set("date", date);
    return request(`/api/dashboard-bookings?${params.toString()}`);
  },

  orders: ({ from, to, limit = 200 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/api/dashboard-orders?${params.toString()}`);
  },
};

export function isUnauthorized(error) {
  return error?.status === 401;
}
