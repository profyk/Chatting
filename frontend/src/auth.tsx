import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, getToken, setToken } from "@/src/api";

export type User = {
  id: string;
  display_name: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  preferred_language: string;
  is_online: boolean;
  is_vip: boolean;
  email?: string;
  privacy?: Record<string, any>;
  push_settings?: Record<string, any>;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: { email: string; password: string; display_name: string; username: string; preferred_language?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const qc = useQueryClient();

  const bootstrap = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUserState(me);
    } catch {
      await setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>("/auth/login", { email: email.trim().toLowerCase(), password });
    await setToken(res.access_token);
    setUserState(res.user);
    router.replace("/(tabs)");
  };

  const signUp = async (body: any) => {
    const res = await api.post<{ access_token: string; user: User }>("/auth/register", body);
    await setToken(res.access_token);
    setUserState(res.user);
    router.replace("/(tabs)");
  };

  const signOut = async () => {
    await setToken(null);
    setUserState(null);
    qc.clear();
    router.replace("/(auth)/welcome");
  };

  const refresh = async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUserState(me);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refresh, setUser: setUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
