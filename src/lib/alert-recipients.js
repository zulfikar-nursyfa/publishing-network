import { z } from "zod";

export const MAX_ALERT_RECIPIENTS = 10;
export const alertRecipient = z.email("Enter a valid email address").trim().toLowerCase();
export const alertRecipientList = z.preprocess(
  (value) => [
    ...new Set(
      String(value ?? "")
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((email) => email.toLowerCase()),
    ),
  ],
  z.array(alertRecipient).max(MAX_ALERT_RECIPIENTS, "Enter up to 10 addresses"),
);
