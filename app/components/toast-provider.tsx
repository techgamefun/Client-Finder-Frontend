"use client";

import { CircleCheck, CircleX, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "warning" | "error";

export interface ToastInput {
  type: ToastKind;
  title: string;
  message: string;
}

interface Toast extends ToastInput {
  id: number;
}

const TOAST_DURATION: Record<ToastKind, number> = {
  success: 5000,
  warning: 7000,
  error: 9000,
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((toast: ToastInput) => {
    const id = ++nextId.current;
    setToasts((current) => [{ ...toast, id }, ...current].slice(0, 4));
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        aria-label="Notifications"
        className="toast-viewport"
        role="region"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            onDismiss={dismissToast}
            toast={toast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return showToast;
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const remainingTime = useRef(TOAST_DURATION[toast.type]);
  const timerStartedAt = useRef<number | null>(null);
  const isPaused = isHovered || isFocused;

  useEffect(() => {
    if (isPaused) return;

    timerStartedAt.current = performance.now();
    const timeout = window.setTimeout(
      () => onDismiss(toast.id),
      remainingTime.current,
    );
    return () => {
      window.clearTimeout(timeout);
      if (timerStartedAt.current !== null) {
        remainingTime.current = Math.max(
          0,
          remainingTime.current -
            (performance.now() - timerStartedAt.current),
        );
        timerStartedAt.current = null;
      }
    };
  }, [isPaused, onDismiss, toast.id]);

  const Icon =
    toast.type === "success"
      ? CircleCheck
      : toast.type === "warning"
        ? Info
        : CircleX;

  return (
    <div
      aria-atomic="true"
      className={`toast toast-${toast.type}${isPaused ? " is-paused" : ""}`}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={toast.type === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="toast-icon" size={20} />
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <span aria-hidden="true" className="toast-progress" />
      <button
        aria-label={`Dismiss ${toast.type} notification`}
        className="toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <X aria-hidden="true" size={17} />
      </button>
    </div>
  );
}
