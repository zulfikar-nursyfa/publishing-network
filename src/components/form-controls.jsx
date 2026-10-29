"use client";

import { useActionState, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertDialog } from "radix-ui";
import { LoaderCircle } from "lucide-react";

import { buttonClass } from "@/components/ui";
import { showActionNotice } from "./action-notice";

export function useActionStateWithNotice(action, initialState) {
  return useActionState(async (previous, data) => {
    let result;
    try {
      result = await action(previous, data);
    } catch (error) {
      // A dropped request, a timeout or a tab older than the last deploy would otherwise replace the page.
      unstable_rethrow(error);
      console.error(error);
      result = { error: "That did not go through. Reload the page to see the current state, then try again." };
    }
    showActionNotice(result);
    return result;
  }, initialState);
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "default",
  className,
  name,
  value,
  confirm,
  confirmLabel,
  disabled = false,
}) {
  const { pending } = useFormStatus();
  const submitterRef = useRef(null);
  const [open, setOpen] = useState(false);
  const label = pending ? (
    <>
      <LoaderCircle className="animate-spin" />
      {pendingLabel ?? children}
    </>
  ) : (
    children
  );

  if (!confirm) {
    return (
      <button
        type="submit"
        name={name}
        value={value}
        disabled={pending || disabled}
        className={buttonClass(variant, className, size)}
      >
        {label}
      </button>
    );
  }

  // The hidden submitter carries name/value into FormData when the dialog confirms.
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button type="button" disabled={pending || disabled} className={buttonClass(variant, className, size)}>
          {label}
        </button>
      </AlertDialog.Trigger>
      <button ref={submitterRef} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden />
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-popover-foreground shadow-2xl data-[state=open]:animate-zoom-in">
          <AlertDialog.Title className="text-base font-semibold">{confirmLabel ?? "Confirm action"}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {confirm}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={buttonClass("secondary")}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              className={buttonClass(
                variant === "danger" || variant === "danger-outline"
                  ? "danger"
                  : variant === "success"
                    ? "success"
                    : "primary",
              )}
              onClick={() => {
                const submitter = submitterRef.current;
                submitter?.form?.requestSubmit(submitter);
              }}
            >
              {confirmLabel ?? "Continue"}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ActionForm({ action, children, success = "Saved.", ...props }) {
  const [, formAction] = useActionStateWithNotice(async (_previous, data) => {
    const result = (await action(data)) ?? { ok: true, message: success };
    return result;
  }, {});
  return (
    <form action={formAction} {...props}>
      {children}
    </form>
  );
}
