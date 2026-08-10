export function formatQuantity(value: number, unit: string | null): string {
  const v = Math.round(value * 10) / 10;
  return `${v}${unit ?? ""}`;
}
