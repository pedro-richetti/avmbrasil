import type { DataValue } from "@avm/domain";

export function formatCurrency(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value: number | undefined, digits = 3): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits
  }).format(value);
}

export function valueToString(value: DataValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function parseFormValue(value: string): DataValue {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const decimalComma = /,\d{1,6}$/.test(trimmed);
  const normalized = decimalComma ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed.replace(/,/g, "");
  const numeric = Number(normalized);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  if (trimmed.toLowerCase() === "true" || trimmed.toLowerCase() === "sim") {
    return true;
  }

  if (trimmed.toLowerCase() === "false" || trimmed.toLowerCase() === "nao" || trimmed.toLowerCase() === "não") {
    return false;
  }

  return trimmed;
}
