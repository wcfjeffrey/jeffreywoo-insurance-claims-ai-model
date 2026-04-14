const TOKEN_KEY = "jw_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Use environment variable or fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  
  const url = `${API_BASE_URL}${path}`;
  console.log(`API Request: ${init?.method || 'GET'} ${url}`);
  
  const res = await fetch(url, { ...init, headers });
  
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  
  // Handle 204 No Content responses (DELETE operations)
  if (res.status === 204) {
    return {} as T;
  }
  
  // Handle empty responses
  const text = await res.text();
  if (!text) {
    return {} as T;
  }
  
  return JSON.parse(text) as T;
}

export const apiUrl = import.meta.env.VITE_API_URL ?? "";