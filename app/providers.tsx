"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { getQueueEventsWebSocketUrl } from "@/lib/api";

type QueueJobEvent = {
  kind: "crawler" | "pagespeed";
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <QueueEventsListener />
      {children}
    </QueryClientProvider>
  );
}

function QueueEventsListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectDelay = 1000;
    let stopped = false;

    function invalidateForKind(kind: QueueJobEvent["kind"]) {
      const queryKeys =
        kind === "crawler"
          ? [
              ["crawler", "queue-jobs"],
              ["website-crawl-job"],
              ["company-website-crawl"],
              ["website-detail"],
              ["websites"],
              ["website-corpus-words"],
              ["company"],
            ]
          : [["pagespeed", "queue-jobs"], ["company"]];
      for (const queryKey of queryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }

    function scheduleReconnect() {
      if (stopped) return;
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      reconnectTimer = setTimeout(connect, delay);
    }

    function connect() {
      if (stopped) return;
      let currentSocket: WebSocket;
      try {
        currentSocket = new WebSocket(getQueueEventsWebSocketUrl());
      } catch (error) {
        console.error("Could not create the queue WebSocket.", error);
        scheduleReconnect();
        return;
      }
      socket = currentSocket;

      currentSocket.onopen = () => {
        reconnectDelay = 1000;
        invalidateForKind("crawler");
        invalidateForKind("pagespeed");
        heartbeat = setInterval(() => {
          if (currentSocket.readyState === WebSocket.OPEN) {
            currentSocket.send(JSON.stringify({ type: "ping" }));
          }
        }, 25_000);
      };

      currentSocket.onmessage = (message) => {
        let event: unknown;
        try {
          event = JSON.parse(String(message.data));
        } catch (error) {
          console.error("Could not parse a queue WebSocket event.", error);
          return;
        }
        if (!isQueueJobEvent(event)) {
          console.error("Received an invalid queue WebSocket event.");
          return;
        }
        invalidateForKind(event.kind);
      };

      currentSocket.onerror = () => currentSocket.close();
      currentSocket.onclose = () => {
        if (heartbeat !== undefined) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
        if (socket === currentSocket) socket = null;
        scheduleReconnect();
      };
    }

    connect();
    return () => {
      stopped = true;
      if (heartbeat !== undefined) clearInterval(heartbeat);
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);

  return null;
}

function isQueueJobEvent(value: unknown): value is QueueJobEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "crawler" || value.kind === "pagespeed") &&
    "id" in value &&
    typeof value.id === "string" &&
    "status" in value &&
    (value.status === "queued" ||
      value.status === "running" ||
      value.status === "succeeded" ||
      value.status === "failed")
  );
}
