"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import { buttonClass, cn } from "@/components/ui";
import { DISPLAY_KEY } from "@/lib/display-script";

const DEFAULTS = { text: "default", motion: "system", links: "default", contrast: "default" };
const OPTIONS = {
  text: [
    { value: "default", label: "Default" },
    { value: "large", label: "Large" },
    { value: "larger", label: "Larger" },
  ],
  motion: [
    { value: "system", label: "Follow device" },
    { value: "reduce", label: "Reduce" },
  ],
  links: [
    { value: "default", label: "Default" },
    { value: "underline", label: "Always underline" },
  ],
  contrast: [
    { value: "default", label: "Default" },
    { value: "more", label: "More contrast" },
  ],
};

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

function apply(settings) {
  const data = document.documentElement.dataset;
  for (const [key, value] of Object.entries(settings)) {
    if (value === DEFAULTS[key]) delete data[key];
    else data[key] = value;
  }
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(settings));
  } catch {
    // Private windows may refuse storage; the setting still applies to this page.
  }
}

/** Theme, text size, motion, link and contrast preferences for this browser. */
export function DisplaySettingsDialog({ open, onOpenChange }) {
  const { theme, setTheme } = useTheme();
  // Only this dialog changes the settings, so reading once is enough. The server gets the defaults,
  // which are never rendered: the dialog is closed on first paint.
  const [settings, setSettings] = useState(read);
  const change = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    apply(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-2xl data-[state=open]:animate-zoom-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold">Display and accessibility</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Saved in this browser and applied straight away.
              </Dialog.Description>
            </div>
            <Dialog.Close className={buttonClass("ghost", "-mt-1 -mr-2", "icon")} aria-label="Close">
              <X />
            </Dialog.Close>
          </div>
          <div className="mt-6 space-y-5">
            <Choice
              legend="Theme"
              name="theme"
              value={theme ?? "system"}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Device" },
              ]}
            />
            <Choice
              legend="Text size"
              name="text"
              value={settings.text}
              onChange={(value) => change("text", value)}
              options={OPTIONS.text}
            />
            <Choice
              legend="Motion"
              hint="Reduce turns off animations and smooth transitions."
              name="motion"
              value={settings.motion}
              onChange={(value) => change("motion", value)}
              options={OPTIONS.motion}
            />
            <Choice
              legend="Links"
              name="links"
              value={settings.links}
              onChange={(value) => change("links", value)}
              options={OPTIONS.links}
            />
            <Choice
              legend="Contrast"
              hint="Darker secondary text and stronger borders and focus outlines."
              name="contrast"
              value={settings.contrast}
              onChange={(value) => change("contrast", value)}
              options={OPTIONS.contrast}
            />
          </div>
          <div className="mt-6 flex justify-between gap-2 border-t pt-4">
            <button
              type="button"
              className={buttonClass("ghost")}
              onClick={() => (setSettings(DEFAULTS), apply(DEFAULTS))}
            >
              Reset
            </button>
            <Dialog.Close className={buttonClass("primary")}>Done</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Choice({ legend, hint, name, value, onChange, options }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div
        className="mt-2 grid gap-1 rounded-lg bg-muted p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-9 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm text-muted-foreground transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
              value === option.value && "bg-card font-medium text-foreground shadow-sm",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
