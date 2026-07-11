type ApiOptions = RequestInit & { token?: string };

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

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
    try {
      const errJson = await response.json();
      if (errJson.message) msg = errJson.message;
    } catch {}
    
    if (response.status === 401) {
      msg = "Sesi Anda telah habis. Silakan login kembali.";
    }
    
    throw new Error(msg);
  }

  return response.json() as Promise<T>;
}
