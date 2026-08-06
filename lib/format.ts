export function numberValue(value: string | number | null | undefined) {
  return value == null || value === "" ? 0 : Number(value);
}

export function formatValue(value: string | number | null, unit: string) {
  if (value == null) return "—";
  const numeric = Number(value);
  if (unit === "USD/month") return `$${numeric.toLocaleString()}/mo`;
  if (unit === "minutes") return `${numeric.toLocaleString()} min`;
  if (unit === "hours/month") return `${numeric.toLocaleString()} hr/mo`;
  return `${numeric.toLocaleString()} ${unit === "count" ? "" : unit}`.trim();
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
