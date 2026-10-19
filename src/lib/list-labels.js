const names = {
  all: "All",
  en: "English",
  ar: "Arabic",
  api: "API",
  admin: "Administrator",
  yes: "Yes",
  no: "No",
  ai: "AI estimate",
  networkShare: "Network share",
  perArticle: "Cost per article",
  ctr: "CTR",
};
export function humanLabel(value) {
  return (
    names[value] ??
    String(value)
      .replaceAll("_", " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}

export function sortLabel(key, direction, column = key) {
  const label = humanLabel(key);
  if (
    [
      "published",
      "discovered",
      "submitted",
      "updated",
      "created",
      "joined",
      "checked",
      "last_published",
      "scheduled",
    ].includes(key) &&
    (column === key || column.endsWith("_at")) &&
    !["drafted", "published"].includes(column)
  )
    return `${direction === "desc" ? "Newest" : "Oldest"} ${key === "last_published" ? "published" : key}`;
  if (
    [
      "views",
      "clicks",
      "impressions",
      "users",
      "ctr",
      "position",
      "amount",
      "cost",
      "calls",
      "searches",
      "order",
      "drafted",
      "published",
      "ai",
      "other",
      "networkShare",
      "total",
      "perArticle",
    ].includes(key)
  )
    return `${label}: ${direction === "desc" ? "High to low" : "Low to high"}`;
  return `${label} ${direction === "asc" ? "A–Z" : "Z–A"}`;
}

export const dateLabels = {
  all: "Any date",
  today: "Today",
  "48h": "Last 48 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom dates",
};
