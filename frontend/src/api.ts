import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const API_URL = `${BASE}/api`;
export const WS_URL = `${BASE.replace(/^http/, "ws")}/api/ws`;

const TOKEN_KEY = "ditsala_access_token";

// In-memory mirror for web (SecureStore has no web impl); native uses secure store.
let memToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (memToken) return memToken;
  const t = await storage.secureGet(TOKEN_KEY, "");
  memToken = t ? (t as string) : null;
  return memToken;
}

export async function setToken(token: string | null) {
  memToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data?.detail || "Request failed", res.status);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any) => request<T>(p, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T = any>(p: string, body?: any) => request<T>(p, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
};

// Build an authenticated media URL. Native attaches the header; web needs the
// token in the query string because <img> cannot send headers.
export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const full = url.startsWith("http") ? url : `${BASE}${url}`;
  if (Platform.OS === "web" && memToken) {
    return `${full}${full.includes("?") ? "&" : "?"}token=${memToken}`;
  }
  return full;
}

// For players that cannot attach headers (audio/video), always append the
// token as a query param (backend accepts ?token= on /files).
export function mediaUrlToken(url?: string | null): string | undefined {
  if (!url) return undefined;
  const full = url.startsWith("http") ? url : `${BASE}${url}`;
  if (!memToken) return full;
  return `${full}${full.includes("?") ? "&" : "?"}token=${memToken}`;
}

export function mediaHeaders(): Record<string, string> {
  return memToken && Platform.OS !== "web" ? { Authorization: `Bearer ${memToken}` } : {};
}

// Upload a local file (from image picker / audio recorder) via multipart.
export async function uploadFile(uri: string, name: string, type: string): Promise<{ url: string; mime: string; size: number; name: string }> {
  const token = await getToken();
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data?.detail || "Upload failed", res.status);
  return data;
}

export { ApiError };
