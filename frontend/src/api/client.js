const BASE = '/api/v1';

let accessToken = null; // kept in memory only, the refresh cookie restores it after a reload
let refreshing = null;

export const setAccessToken = (t) => {
  accessToken = t;
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(path, opts = {}) {
  const hasBody = opts.body !== undefined && !(opts.body instanceof FormData);
  const headers = { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(BASE + path, {
    credentials: 'include',
    ...opts,
    headers,
    body: hasBody ? JSON.stringify(opts.body) : opts.body,
  });
}

// concurrent callers share one refresh request (refresh tokens rotate, so two at once would clash)
export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('no session');
        const d = await r.json();
        accessToken = d.accessToken;
        return accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api(path, opts = {}) {
  let res = await send(path, opts);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      res = await send(path, opts);
    } catch {
      accessToken = null;
      window.dispatchEvent(new Event('auth:expired'));
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status === 429 ? 'Too many requests, please try again in a moment' : 'Something went wrong';
    throw new ApiError(data.message || fallback, res.status, data.details);
  }
  return data;
}