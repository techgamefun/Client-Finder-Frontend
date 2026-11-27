"use client";

import { Toaster, toast } from "sonner";
import type { ReactNode } from "react";

export type ToastKind = "success" | "warning" | "error";

export interface ToastInput {
  type: ToastKind;
  title: string;
  message: string;
}

const toastDurations: Record<ToastKind, number> = {
  success: 5000,
  warning: 7000,
  error: 9000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        className="app-toast-toaster"
        closeButton
        containerAriaLabel="Notifications"
        mobileOffset={10}
        offset={16}
        position="top-right"
        richColors
        theme="light"
        toastOptions={{ closeButtonAriaLabel: "Dismiss notification" }}
        visibleToasts={4}
      />
    </>
  );
}

export function useToast() {
  return showToast;
}

function showToast({ type, title, message }: ToastInput) {
  const options = {
    description: message,
    duration: toastDurations[type],
  };

  switch (type) {
    case "success":
      toast.success(title, options);
      break;
    case "warning":
      toast.warning(title, options);
      break;
    case "error":
      toast.error(title, options);
      break;
  }
}
