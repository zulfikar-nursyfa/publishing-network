"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { cn } from "./ui";

export function showActionNotice(result) {
  const message = result?.error || result?.message;
  if (!message) return;
  window.dispatchEvent(
    new CustomEvent("pn-notice", {
      detail: { message, tone: result.error || result.ok === false ? "error" : "success" },
    }),
  );
}

export function ActionNotice() {
  const [notice, setNotice] = useState(null);
  const nextId = useRef(0);
  useEffect(() => {
    const show = (event) => setNotice({ ...event.detail, id: ++nextId.current });
    window.addEventListener("pn-notice", show);
    return () => window.removeEventListener("pn-notice", show);
  }, []);
  // Errors stay longer so they can be read; hovering or focusing the notice pauses the countdown.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!notice || paused) return;
    const timer = setTimeout(() => setNotice(null), notice.tone === "error" ? 10_000 : 5000);
    return () => clearTimeout(timer);
  }, [notice, paused]);

  if (!notice) return null;
  const isError = notice.tone === "error";
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <div
      key={notice.id}
      role={isError ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "fixed right-4 bottom-4 left-4 z-[60] flex items-start gap-3 rounded-lg border p-3 pl-4 text-sm shadow-lg sm:left-auto sm:w-max sm:max-w-sm",
        isError
          ? "border-destructive bg-destructive text-destructive-foreground"
          : "border-success bg-success text-success-foreground",
      )}
    >
      <Icon aria-hidden="true" className="mt-3 size-4 shrink-0" />
      <span className="min-w-0 flex-1 self-center break-words py-2">{notice.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        onClick={() => {
          setNotice(null);
          setPaused(false);
        }}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

// Redirected actions cannot return action state. Consume their feedback flags once.
export function RedirectNotice({ result, params }) {
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    showActionNotice(result);
    const url = new URL(window.location.href);
    for (const param of params) url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", url);
  }, [result, params]);
  return null;
}
