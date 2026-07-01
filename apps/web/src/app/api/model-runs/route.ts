import { NextResponse } from "next/server";
import type { MarketComparable, SubjectProperty, VariableDefinition } from "@avm/domain";
import { runModelSearch, type ModelSearchInput } from "@avm/valuation-core";

export const runtime = "nodejs";

interface ModelRunRequest {
  comparables: MarketComparable[];
  variables: VariableDefinition[];
  subjectValues?: SubjectProperty["values"];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ModelRunRequest;

    if (!Array.isArray(payload.comparables) || payload.comparables.length === 0) {
      return NextResponse.json({ error: "Amostra de mercado vazia." }, { status: 400 });
    }

    if (!Array.isArray(payload.variables) || payload.variables.length === 0) {
      return NextResponse.json({ error: "Variáveis não definidas." }, { status: 400 });
    }

    const modelInput: ModelSearchInput = {
      comparables: payload.comparables,
      variables: payload.variables,
      minVariables: 1,
      maxVariables: 5
    };

    if (payload.subjectValues) {
      modelInput.subjectValues = payload.subjectValues;
    }

    const modelRun = runModelSearch(modelInput);

    return NextResponse.json(modelRun);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao executar a modelagem." },
      { status: 500 }
    );
  }
}
