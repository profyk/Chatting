import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

import { getToken, WS_URL } from "@/src/api";
import { useAuth } from "@/src/auth";

export type RealtimeEvent = {
  type: string;
  [key: string]: any;
};

type Listener = (e: RealtimeEvent) => void;

type RealtimeState = {
  connected: boolean;
  presence: Record<string, boolean>;
  incomingCall: any | null;
  clearIncomingCall: () => void;
  subscribe: (cb: Listener) => () => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  sendSignal: (to: string[], callId: string, signal: any) => void;
};

const RealtimeContext = createContext<RealtimeState | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const reconnectRef = useRef<any>(null);

  const emit = useCallback((e: RealtimeEvent) => {
    listeners.current.forEach((l) => {
      try {
        l(e);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const connect = useCallback(async () => {
    if (!user) return;
    const token = await getToken();
    if (!token) return;
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      if (user) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connect, 2500);
      }
    };
    ws.onmessage = (evt) => {
      let data: RealtimeEvent;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      switch (data.type) {
        case "presence":
          setPresence((p) => ({ ...p, [data.user_id]: data.is_online }));
          break;
        case "message:new":
        case "message:update":
        case "message:delete":
        case "message:react":
        case "message:read":
          qc.invalidateQueries({ queryKey: ["conversations"] });
          break;
        case "conversation:new":
        case "conversation:update":
          qc.invalidateQueries({ queryKey: ["conversations"] });
          break;
        case "call:incoming":
          setIncomingCall({ ...data.call, caller: data.caller });
          break;
      }
      emit(data);
    };
  }, [user, qc, emit]);

  useEffect(() => {
    if (user) {
      connect();
    }
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, connect]);

  const subscribe = useCallback((cb: Listener) => {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", conversation_id: conversationId, is_typing: isTyping }));
    }
  }, []);

  const sendSignal = useCallback((to: string[], callId: string, signal: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "call:signal", to, call_id: callId, signal }));
    }
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        presence,
        incomingCall,
        clearIncomingCall: () => setIncomingCall(null),
        subscribe,
        sendTyping,
        sendSignal,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
