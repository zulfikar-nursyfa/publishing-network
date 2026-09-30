"use client";

import { useFormStatus } from "react-dom";

import { buttonClass, cn } from "@/components/ui";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  name,
  value,
  confirm,
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant, className)}
      onClick={confirm ? (event) => { if (!window.confirm(confirm)) event.preventDefault(); } : undefined}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function FormAlert({ state }) {
  if (state.error) {
    return <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>;
  }
  if (state.message) {
    return (
      <div role="status" className={cn("rounded-md border px-3 py-2 text-sm", state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-gray-50 text-gray-800")}>
        {state.message}
      </div>
    );
  }
  return null;
}
