import type { DataValue, MarketComparable, VariableDefinition, VariableKind } from "@avm/domain";
import { inferVariableKind } from "@avm/valuation-core";
import { parseFormValue } from "./format";

export function parseDelimitedMarketData(text: string): { comparables: MarketComparable[]; variables: VariableDefinition[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Arquivo sem linhas suficientes.");
  }

  const delimiter = inferDelimiter(lines[0] ?? "");
  const headers = splitLine(lines[0] ?? "", delimiter).map(normalizeHeader);
  const comparables = lines.slice(1).map((line, index) => {
    const cells = splitLine(line, delimiter);
    const values: Record<string, DataValue> = {};

    headers.forEach((header, headerIndex) => {
      values[header] = parseFormValue(cells[headerIndex] ?? "");
    });

    return {
      id: `import-${index + 1}`,
      source: "Importação",
      capturedAt: new Date().toISOString().slice(0, 10),
      values
    };
  });

  return {
    comparables,
    variables: inferVariables(comparables, headers)
  };
}

export function inferVariables(comparables: MarketComparable[], headers: string[]): VariableDefinition[] {
  const targetHeader = headers.find((header) => /^(price|preco|preço|valor|valor_total|valoroferta)$/i.test(header)) ?? headers[0];

  return headers.map((header) => {
    const values = comparables.map((row) => row.values[header] ?? null);
    const kind = inferKind(values);
    const isTarget = header === targetHeader;

    return {
      id: header,
      label: labelize(header),
      sourceField: header,
      role: isTarget ? "target" : "feature",
      kind,
      transform: "none",
      required: /area|privativa|terreno/i.test(header),
      expectedSign: expectedSignFor(header),
      notes: `Tipo inferido automaticamente como ${kind}.`
    };
  });
}

export function rowsFromObjects(objects: Record<string, unknown>[]): { comparables: MarketComparable[]; variables: VariableDefinition[] } {
  const headers = Array.from(new Set(objects.flatMap((row) => Object.keys(row).map(normalizeHeader))));
  const comparables = objects.map((object, index) => {
    const values: Record<string, DataValue> = {};

    for (const [key, value] of Object.entries(object)) {
      values[normalizeHeader(key)] = parseFormValue(String(value ?? ""));
    }

    return {
      id: `xlsx-${index + 1}`,
      source: "Planilha",
      capturedAt: new Date().toISOString().slice(0, 10),
      values
    };
  });

  return {
    comparables,
    variables: inferVariables(comparables, headers)
  };
}

function inferDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts = {
    ",": (headerLine.match(/,/g) ?? []).length,
    ";": (headerLine.match(/;/g) ?? []).length,
    "\t": (headerLine.match(/\t/g) ?? []).length
  };

  return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] as "," | ";" | "\t") ?? ",";
}

function splitLine(line: string, delimiter: "," | ";" | "\t"): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "v_$1")
    .toLowerCase();
}

function labelize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Preco", "Preço");
}

function inferKind(values: DataValue[]): VariableKind {
  return inferVariableKind(values);
}

function expectedSignFor(header: string) {
  if (/area|quarto|dorm|vaga|suite|frente|padrao|qualidade/i.test(header)) {
    return "positive" as const;
  }

  if (/idade|dist|tempo|condominio|taxa|reforma/i.test(header)) {
    return "negative" as const;
  }

  return "none" as const;
}
