// ====================================================================
// HTTP client (fetch wrapper)
// - Reads base URL from VITE_API_BASE
// - Automatically adds Bearer token from localStorage or override
// - Unified error handling and JSON parsing
// ====================================================================
let baseURL = (import.meta.env.VITE_API_BASE as string) ?? "";
let overrideAuthToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

// Remove trailing slashes from base URL
function normalizeBase(url: string) {
  return (url || "").replace(/\/+$/, "");
}

// Pick token: override > localStorage(access_token) > localStorage(token)
function pickToken(): string | null {
  return (
    overrideAuthToken ??
    localStorage.getItem("access_token") ??
    localStorage.getItem("token") ??
    null
  );
}

// Optional: set base URL (normally not needed; .env controls it)
export function setBaseURL(url: string) {
  baseURL = normalizeBase(url);
}

// Optional: override token (rarely needed)
export function setAuthToken(token: string | null) {
  overrideAuthToken = token || null;
}

// Optional: register a 401 callback (e.g., clear user state)
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// Core request helper (CORS by default, no credentials)
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isAbsolute = /^https?:\/\//i.test(path);
  const base = normalizeBase(baseURL || "");
  const url = isAbsolute ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    ...(init.headers as any),
  };

  // Default headers (skip when using FormData)
  const isForm = init.body instanceof FormData;
  if (!isForm && init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (!headers["Accept"]) headers["Accept"] = "application/json, text/plain, */*";

  // Auto add Authorization header if not provided
  const token = pickToken();
  const hasAuthHeader = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
  if (token && !hasAuthHeader) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const reqInit: RequestInit = {
    mode: "cors",
    cache: "no-store",
    ...init,
    headers,
  };

  let res: Response;
  try {
    res = await fetch(url, reqInit);
  } catch (err: any) {
    const m = err?.message || String(err);
    throw new Error(`[fetch] Failed to fetch ${url} - ${m}`);
  }

  // Notify caller on 401 (e.g., to clear tokens/UI)
  if (res.status === 401 && onUnauthorized) {
    try {
      onUnauthorized();
    } catch {}
  }

  // Normalize non-2xx errors (try to extract server message)
  if (!res.ok) {
    let msg = `HTTP ${res.status} ${res.statusText}`;
    const ctErr = res.headers.get("content-type") || "";
    try {
      if (ctErr.includes("application/json")) {
        const j = await res.json();
        const bodyMsg =
          (typeof j === "string" && j) ||
          (j && (j.message || j.detail)) ||
          JSON.stringify(j);
        if (bodyMsg) msg += ` - ${bodyMsg}`;
      } else {
        const t = await res.text();
        if (t) msg += ` - ${t}`;
      }
    } catch {}
    throw new Error(msg);
  }

  // No content
  if (res.status === 204 || res.status === 205) {
    return undefined as unknown as T;
  }

  // Auto parse JSON; otherwise return text
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}

// Serialize simple object into query string (?k=v&...)
function toQuery(q?: Record<string, any>) {
  if (!q || !Object.keys(q).length) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// Public client API
export const http = {
  get: <T>(path: string, query?: Record<string, any>, init?: RequestInit) =>
    request<T>(`${path}${toQuery(query)}`, { method: "GET", ...(init || {}) }),

  post: <T>(path: string, body?: any, init?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
      ...(init || {}),
    }),

  put: <T>(path: string, body?: any, init?: RequestInit) =>
    request<T>(path, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      ...(init || {}),
    }),

  del: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...(init || {}) }),

  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...(init || {}) }),

  setBaseURL,
  setAuthToken,
  setOnUnauthorized,
  get baseURL() {
    return baseURL;
  },
};

// Initialize base URL once
setBaseURL(baseURL || "");
