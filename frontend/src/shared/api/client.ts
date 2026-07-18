type ApiOptions = RequestInit & { token?: string };

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

/** Error API yang membawa status HTTP & body respons agar pemanggil bisa
 *  membedakan kasus (mis. 403 dengan account_status saat login). */
export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (apiBase.startsWith("http")) {
    const base = new URL(apiBase);
    const origin = `${base.protocol}//${base.host}`;
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path.startsWith("/") ? path : `${apiBase}/${path}`;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("siperah-token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("siperah-token");
      window.dispatchEvent(new CustomEvent("siperah-auth-expired"));
      window.location.hash = "#/login";
    }

    let msg = `API ${response.status}: ${response.statusText}`;
    let body: any = null;
    try {
      body = await response.json();
      if (body?.message) msg = body.message;
    } catch {}

    if (response.status === 401) {
      msg = "Sesi Anda telah habis. Silakan login kembali.";
    }

    throw new ApiError(msg, response.status, body);
  }

  return response.json() as Promise<T>;
}
