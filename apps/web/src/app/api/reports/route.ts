import { NextResponse } from "next/server";
import type { CandidateModel, MarketComparable, ModelRun, SubjectProperty, VariableDefinition } from "@avm/domain";

export const runtime = "nodejs";

interface ReportRequest {
  project: {
    name: string;
    purpose: string;
    valuationDate: string;
    responsible: string;
  };
  subject: SubjectProperty;
  comparables: MarketComparable[];
  variables: VariableDefinition[];
  modelRun: ModelRun;
  candidateModelId: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ReportRequest;
    const candidate = payload.modelRun.candidates.find((item) => item.id === payload.candidateModelId);

    if (!candidate) {
      return NextResponse.json({ error: "Modelo aprovado não encontrado." }, { status: 400 });
    }

    const snapshot = {
      id: `report-${Date.now()}`,
      createdAt: new Date().toISOString(),
      approvedBy: payload.project.responsible,
      project: payload.project,
      subject: payload.subject,
      comparableCount: payload.comparables.length,
      variables: payload.variables,
      rulePack: payload.modelRun.rulePack,
      candidate
    };

    return NextResponse.json({
      snapshot,
      html: renderReportHtml(snapshot)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar relatório." },
      { status: 500 }
    );
  }
}

function renderReportHtml(snapshot: {
  id: string;
  createdAt: string;
  approvedBy: string;
  project: ReportRequest["project"];
  subject: SubjectProperty;
  comparableCount: number;
  variables: VariableDefinition[];
  rulePack: ModelRun["rulePack"];
  candidate: CandidateModel;
}): string {
  const valuation = snapshot.candidate.valuation;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(snapshot.project.name)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1c2526; margin: 36px; line-height: 1.45; }
      h1, h2 { margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border: 1px solid #d9dee7; padding: 8px; text-align: left; }
      th { background: #f2f4f7; }
      .equation { background: #0f172a; color: #e2e8f0; padding: 12px; font-family: monospace; }
      .muted { color: #667085; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(snapshot.project.name)}</h1>
    <p class="muted">Relatório MVP gerado em ${escapeHtml(new Date(snapshot.createdAt).toLocaleString("pt-BR"))}</p>
    <h2>Imóvel avaliando</h2>
    <p>${escapeHtml(snapshot.subject.address)} - ${escapeHtml(snapshot.subject.city)}/${escapeHtml(snapshot.subject.state)}</p>
    <h2>Resultado</h2>
    <p>Valor estimado: <strong>${formatCurrency(valuation?.estimate)}</strong></p>
    <p>Intervalo preliminar: ${formatCurrency(valuation?.lower)} a ${formatCurrency(valuation?.upper)}</p>
    <div class="equation">${escapeHtml(snapshot.candidate.equation)}</div>
    <h2>Diagnósticos</h2>
    <table>
      <tr><th>R² ajustado</th><td>${snapshot.candidate.diagnostics.adjustedR2.toFixed(4)}</td></tr>
      <tr><th>RMSE</th><td>${snapshot.candidate.diagnostics.rmse.toFixed(2)}</td></tr>
      <tr><th>p-valor global</th><td>${snapshot.candidate.diagnostics.fPValue.toFixed(4)}</td></tr>
      <tr><th>VIF máximo</th><td>${snapshot.candidate.diagnostics.maxVif.toFixed(2)}</td></tr>
    </table>
    <h2>Checklist preliminar</h2>
    <table>
      <thead><tr><th>Critério</th><th>Status</th><th>Mensagem</th></tr></thead>
      <tbody>
        ${snapshot.candidate.ruleChecks
          .map(
            (check) =>
              `<tr><td>${escapeHtml(check.label)}</td><td>${escapeHtml(check.status)}</td><td>${escapeHtml(check.message)}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
    <p class="muted">${escapeHtml(snapshot.rulePack.notes)}</p>
    <p>Aprovado por: ${escapeHtml(snapshot.approvedBy)}</p>
  </body>
</html>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}
