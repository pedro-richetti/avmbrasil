"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileDown,
  FileText,
  Info,
  Play,
  Settings2,
  Upload,
  XCircle
} from "lucide-react";
import type {
  CandidateModel,
  ExpectedSign,
  MarketComparable,
  ModelRun,
  SubjectProperty,
  TransformKind,
  VariableDefinition,
  VariableKind,
  VariableRole
} from "@avm/domain";
import { parseGridData, rowsFromObjects } from "@/lib/imports";
import { DataGrid } from "./data-grid";
import { formatCurrency, formatNumber, parseFormValue, valueToString } from "@/lib/format";
import { CriteriaModal } from "./criteria-modal";
import type { RulePackCheck } from "@avm/domain";

type ProjectState = {
  name: string;
  purpose: string;
  valuationDate: string;
  responsible: string;
};

type ReportState = {
  snapshot: unknown;
  html: string;
};

const projectDefault: ProjectState = {
  name: "Avaliação MVP - Apartamento urbano",
  purpose: "Determinação de valor de mercado",
  valuationDate: "2026-06-26",
  responsible: "Eng. Responsável"
};

type SectionId = "project" | "subject" | "market-data" | "variables" | "subject-values" | "models" | "report";

const sectionNavItems: Array<{ id: SectionId; label: string }> = [
  { id: "project", label: "Projeto" },
  { id: "subject", label: "Imóvel avaliando" },
  { id: "market-data", label: "Dados de mercado" },
  { id: "variables", label: "Variáveis" },
  { id: "subject-values", label: "Valores do avaliando" },
  { id: "models", label: "Modelos e diagnóstico" },
  { id: "report", label: "Relatório" }
];

function buildExpandedSections(expanded: boolean): Record<SectionId, boolean> {
  return sectionNavItems.reduce(
    (sections, item) => ({
      ...sections,
      [item.id]: expanded
    }),
    {} as Record<SectionId, boolean>
  );
}

export function ProjectWorkspace() {
  const [project, setProject] = useState<ProjectState>(projectDefault);
  const [subject, setSubject] = useState<SubjectProperty>({
    id: "subject-demo",
    projectId: "project-demo",
    address: "",
    city: "",
    state: "",
    propertyType: "Apartamento",
    values: {}
  });
  const [comparables, setComparables] = useState<MarketComparable[]>([]);
  const [variables, setVariables] = useState<VariableDefinition[]>([]);
    const [modelRun, setModelRun] = useState<ModelRun | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [approvedCandidateId, setApprovedCandidateId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportState | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "reporting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<SectionId, boolean>>(() => buildExpandedSections(true));
  const [analyzedCheck, setAnalyzedCheck] = useState<RulePackCheck | null>(null);
  const [scoreBreakdownCandidate, setScoreBreakdownCandidate] = useState<CandidateModel | null>(null);

  const selectedCandidate = useMemo(
    () => modelRun?.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [modelRun, selectedCandidateId]
  );
  const approvedCandidate = useMemo(
    () => modelRun?.candidates.find((candidate) => candidate.id === approvedCandidateId) ?? null,
    [modelRun, approvedCandidateId]
  );
  const columns = useMemo(() => Object.keys(comparables[0]?.values ?? {}), [comparables]);
  const featureVariables = variables.filter((variable) => variable.role === "feature");
  const targetVariable = variables.find((variable) => variable.role === "target");
  const acceptedCount = modelRun?.candidates.filter((candidate) => candidate.accepted).length ?? 0;

  function setSectionExpanded(sectionId: SectionId, expanded: boolean) {
    setExpandedSections((current) => ({ ...current, [sectionId]: expanded }));
  }

  function setAllSections(expanded: boolean) {
    setExpandedSections(buildExpandedSections(expanded));
  }

  function focusSection(sectionId: SectionId) {
    setExpandedSections((current) => ({ ...current, [sectionId]: true }));

    window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);

      if (!section) {
        return;
      }

      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.focus({ preventScroll: true });
    });
  }

  function updateProject<K extends keyof ProjectState>(key: K, value: ProjectState[K]) {
    setProject((current) => ({ ...current, [key]: value }));
  }

  function updateSubjectValue(field: string, value: string) {
    setSubject((current) => ({
      ...current,
      values: {
        ...current.values,
        [field]: parseFormValue(value)
      }
    }));
  }

  function updateVariable(id: string, patch: Partial<VariableDefinition>) {
    setVariables((current) =>
      current.map((variable) => {
        if (variable.id === id) {
          return { ...variable, ...patch };
        }

        if (patch.role === "target" && variable.role === "target") {
          return { ...variable, role: "excluded" };
        }

        return variable;
      })
    );
    setReport(null);
    setApprovedCandidateId(null);
  }


  function handleGridSave(grid: string[][]) {
    try {
      const parsed = parseGridData(grid);
      setComparables(parsed.comparables);
      setVariables(parsed.variables);
      setModelRun(null);
      setSelectedCandidateId(null);
      setApprovedCandidateId(null);
      setReport(null);
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Falha ao ler dados da tabela.");
    }
  }


  async function importFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const { readSheet } = await import("read-excel-file/browser");
      const rows = await readSheet(file);
      const headerRow = rows[0];

      if (!headerRow || rows.length < 2) {
        throw new Error("Planilha sem cabeçalho e linhas de dados.");
      }

      const headers = headerRow.map((cell: unknown) => String(cell ?? ""));
      const objects = rows.slice(1).map((row: unknown[]) =>
        Object.fromEntries(headers.map((header: string, index: number) => [header, row[index] ?? ""])) as Record<string, unknown>
      );
      const parsed = rowsFromObjects(objects);
      setComparables(parsed.comparables);
      setVariables(parsed.variables);
      setModelRun(null);
      setSelectedCandidateId(null);
      setApprovedCandidateId(null);
      setReport(null);
      setError(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Falha ao importar planilha.");
    }
  }

  async function runModeling() {
    setStatus("running");
    setError(null);
    setReport(null);
    setApprovedCandidateId(null);

    try {
      const response = await fetch("/api/model-runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          comparables,
          variables,
          subjectValues: subject.values
        })
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) ? payload.error : "Falha na modelagem.");
      }

      const modelPayload = payload as ModelRun;
      setModelRun(modelPayload);
      setSelectedCandidateId(modelPayload.selectedCandidateId ?? modelPayload.candidates[0]?.id ?? null);
    } catch (modelError) {
      setError(modelError instanceof Error ? modelError.message : "Falha na modelagem.");
    } finally {
      setStatus("idle");
    }
  }

  async function generateReport() {
    if (!modelRun || !approvedCandidateId) {
      return;
    }

    setStatus("reporting");
    setError(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project,
          subject,
          comparables,
          variables,
          modelRun,
          candidateModelId: approvedCandidateId
        })
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) ? payload.error : "Falha ao gerar relatório.");
      }

      setReport(payload as ReportState);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Falha ao gerar relatório.");
    } finally {
      setStatus("idle");
    }
  }

  function downloadReport() {
    if (!report) {
      return;
    }

    const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-relatorio.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!report) {
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(report.html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handleLogout() {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AV</div>
          <div>
            <h1>AVM Brasil</h1>
            <span>NBR 14653-2 MVP</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="nav-action" type="button" onClick={() => setAllSections(true)}>
            Expandir tudo
          </button>
          <button className="nav-action" type="button" onClick={() => setAllSections(false)}>
            Recolher tudo
          </button>
          <div className="topbar-divider" />
          <span className={targetVariable ? "status-pill success" : "status-pill warn"}>
            {targetVariable ? <CheckCircle2 className="icon" /> : <AlertTriangle className="icon" />}
            {targetVariable ? "Alvo definido" : "Sem alvo"}
          </span>
          <span className="status-pill">
            <Database className="icon" />
            {comparables.length} dados
          </span>
          <button className="btn primary" disabled={status === "running"} onClick={runModeling}>
            <Play className="icon" />
            {status === "running" ? "Rodando" : "Rodar modelos"}
          </button>
          <div className="topbar-divider" />
          <button className="btn" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="panel section-nav" aria-label="Seções da avaliação">
            <div className="section-nav-header">
              <span>Fluxo da avaliação</span>
              <FileText className="icon" />
            </div>
            {sectionNavItems.map((item, index) => (
              <a
                className="section-nav-link"
                href={`#${item.id}`}
                key={item.id}
                onClick={(event) => {
                  event.preventDefault();
                  focusSection(item.id);
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <section className="main-grid">
          {error ? (
            <div className="panel">
              <div className="status-pill warn">
                <AlertTriangle className="icon" />
                {error}
              </div>
            </div>
          ) : null}

          <div className="two-column">
            <CollapsibleSection
              id="project"
              title="Projeto"
              description="Identificação da finalidade, data-base e responsável técnico."
              icon={<FileText className="icon" />}
              expanded={expandedSections.project}
              onToggle={() => setSectionExpanded("project", !expandedSections.project)}
            >
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="project-name">Nome</label>
                  <input id="project-name" value={project.name} onChange={(event) => updateProject("name", event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="project-purpose">Finalidade</label>
                  <input
                    id="project-purpose"
                    value={project.purpose}
                    onChange={(event) => updateProject("purpose", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="project-date">Data</label>
                  <input
                    id="project-date"
                    type="date"
                    value={project.valuationDate}
                    onChange={(event) => updateProject("valuationDate", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="project-responsible">Responsável</label>
                  <input
                    id="project-responsible"
                    value={project.responsible}
                    onChange={(event) => updateProject("responsible", event.target.value)}
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="subject"
              title="Imóvel avaliando"
              description="Dados básicos do bem que será estimado pela equação."
              icon={<ClipboardCheck className="icon" />}
              expanded={expandedSections.subject}
              onToggle={() => setSectionExpanded("subject", !expandedSections.subject)}
            >
              <div className="summary-list">
                <div className="field">
                  <label htmlFor="subject-address">Endereço</label>
                  <input
                    id="subject-address"
                    value={subject.address}
                    onChange={(event) => setSubject((current) => ({ ...current, address: event.target.value }))}
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="subject-city">Cidade</label>
                    <input
                      id="subject-city"
                      value={subject.city}
                      onChange={(event) => setSubject((current) => ({ ...current, city: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="subject-state">UF</label>
                    <input
                      id="subject-state"
                      value={subject.state}
                      onChange={(event) => setSubject((current) => ({ ...current, state: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          <CollapsibleSection
            id="market-data"
            title="Dados de mercado"
            description="CSV, XLSX ou XLS com colunas normalizadas e amostra preservada."
            icon={<Upload className="icon" />}
            expanded={expandedSections["market-data"]}
            onToggle={() => setSectionExpanded("market-data", !expandedSections["market-data"])}
          >
            <div className="two-column">
              <div className="card inner-box">
                <div className="panel-header">
                  <div>
                    <h3>Importação</h3>
                    <p>Dados comparáveis usados na modelagem.</p>
                  </div>
                  <Upload className="icon" />
                </div>
                <div className="field" style={{ overflowX: "auto" }}>
                  <DataGrid initialRows={5} initialCols={5} onSave={handleGridSave} />
                </div>
                <div className="button-row" style={{ marginTop: 12 }}>
                  {/* CSV import button removed to favor DataGrid */}
                  <label className="btn" htmlFor="file-import">
                    <FileDown className="icon" />
                    Importar planilha
                  </label>
                  <input
                    id="file-import"
                    type="file"
                    accept=".xlsx"
                    style={{ display: "none" }}
                    onChange={(event) => void importFile(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="card inner-box">
                <div className="panel-header">
                  <div>
                    <h3>Amostra</h3>
                    <p>{comparables.length > 0 ? `${columns.length} colunas normalizadas.` : "Aguardando dados da importação."}</p>
                  </div>
                  <Database className="icon" />
                </div>
                {comparables.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {columns.map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparables.map((row) => (
                          <tr key={row.id}>
                            {columns.map((column) => (
                              <td key={column}>{valueToString(row.values[column])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div>
                      <h3>Amostra vazia</h3>
                      <p>Importe ou adicione dados na tabela para iniciar.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="variables"
            title="Variáveis"
            description="Tipos inferidos por dados; transformações são triadas automaticamente na busca."
            icon={<Settings2 className="icon" />}
            expanded={expandedSections.variables}
            onToggle={() => setSectionExpanded("variables", !expandedSections.variables)}
          >
            {variables.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Papel</th>
                      <th>Tipo</th>
                      <th>Transformação base</th>
                      <th>Sinal</th>
                      <th>Obrigatória</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((variable) => (
                      <tr key={variable.id}>
                        <td>
                          <strong>{variable.label}</strong>
                          <br />
                          <span className="status-pill">{variable.sourceField}</span>
                          {variable.notes ? (
                            <>
                              <br />
                              <span>{variable.notes}</span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <select
                            value={variable.role}
                            onChange={(event) => updateVariable(variable.id, { role: event.target.value as VariableRole })}
                          >
                            <option value="target">Alvo</option>
                            <option value="feature">Explicativa</option>
                            <option value="excluded">Excluída</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={variable.kind}
                            onChange={(event) => updateVariable(variable.id, { kind: event.target.value as VariableKind })}
                          >
                            <option value="numeric">Numérica</option>
                            <option value="binary">Binária</option>
                            <option value="categorical">Categórica</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={variable.transform}
                            disabled={variable.kind === "categorical"}
                            onChange={(event) => updateVariable(variable.id, { transform: event.target.value as TransformKind })}
                          >
                            <option value="none">Nenhuma</option>
                            <option value="log">Log</option>
                            <option value="sqrt">Raiz</option>
                            <option value="square">Quadrado</option>
                            <option value="inverse">Inversa</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={variable.expectedSign ?? "none"}
                            onChange={(event) =>
                              updateVariable(variable.id, { expectedSign: event.target.value as ExpectedSign })
                            }
                          >
                            <option value="none">Livre</option>
                            <option value="positive">Positivo</option>
                            <option value="negative">Negativo</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(variable.required)}
                            onChange={(event) => updateVariable(variable.id, { required: event.target.checked })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <h3>Nenhuma variável</h3>
                  <p>As variáveis serão inferidas automaticamente após a importação dos dados de mercado.</p>
                </div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="subject-values"
            title="Valores do avaliando"
            description="Campos explicativos aplicados à equação aprovada."
            icon={<Calculator className="icon" />}
            expanded={expandedSections["subject-values"]}
            onToggle={() => setSectionExpanded("subject-values", !expandedSections["subject-values"])}
          >
            {featureVariables.length > 0 ? (
              <div className="form-grid">
                {featureVariables.map((variable) => (
                  <div className="field" key={variable.id}>
                    <label htmlFor={`subject-${variable.id}`}>{variable.label}</label>
                    <input
                      id={`subject-${variable.id}`}
                      value={valueToString(subject.values[variable.sourceField])}
                      onChange={(event) => updateSubjectValue(variable.sourceField, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <h3>Aguardando dados</h3>
                  <p>As variáveis explicativas aparecerão aqui após a importação dos dados.</p>
                </div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="models"
            title="Modelos e diagnóstico"
            description="Comparação dos candidatos, critérios, resíduos e aprovação técnica."
            icon={<BarChart3 className="icon" />}
            expanded={expandedSections.models}
            onToggle={() => setSectionExpanded("models", !expandedSections.models)}
          >
            {modelRun ? (
              <div className="models-grid">
                <div className="card inner-box">
                  <div className="panel-header">
                    <div>
                      <h3>Modelos candidatos</h3>
                      <p>
                        {acceptedCount} aceitos de {modelRun.candidates.length} avaliados.
                      </p>
                    </div>
                    <BarChart3 className="icon" />
                  </div>
                  <div className="candidate-list">
                    {modelRun.candidates.slice(0, 10).map((candidate) => (
                      <button
                        key={candidate.id}
                        className={[
                          "candidate-card",
                          selectedCandidateId === candidate.id ? "selected" : "",
                          candidate.accepted ? "" : "rejected"
                        ].join(" ")}
                        onClick={() => setSelectedCandidateId(candidate.id)}
                      >
                        <div className="candidate-topline">
                          <strong>{candidate.accepted ? "Aceito" : "Rejeitado"}</strong>
                          <span className={candidate.accepted ? "status-pill success" : "status-pill warn"}>
                            {candidate.accepted ? <CheckCircle2 className="icon" /> : <XCircle className="icon" />}
                            Score {formatNumber(candidate.score, 1)}
                            {candidate.scoreBreakdown && (
                              <button
                                className="icon-button"
                                style={{ marginLeft: "4px", padding: 0, background: "transparent", border: "none" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScoreBreakdownCandidate(candidate);
                                }}
                                title="Ver composição do score"
                              >
                                <Info className="icon" style={{ width: "14px", height: "14px", color: "inherit", cursor: "pointer" }} />
                              </button>
                            )}
                          </span>
                        </div>
                        <div className="candidate-metrics">
                          <span className="metric-pill">R² aj. {formatNumber(candidate.diagnostics.adjustedR2, 3)}</span>
                          <span className="metric-pill">RMSE {formatNumber(candidate.diagnostics.rmse, 0)}</span>
                          <span className="metric-pill">VIF {formatNumber(candidate.diagnostics.maxVif, 2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <ModelDetail
                  candidate={selectedCandidate}
                  approved={approvedCandidateId === selectedCandidate?.id}
                  onApprove={() => {
                    if (selectedCandidate?.accepted) {
                      setApprovedCandidateId(selectedCandidate.id);
                      setReport(null);
                    }
                  }}
                  onAnalyzeCheck={(check) => setAnalyzedCheck(check)}
                />
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <h3>Nenhum modelo rodado</h3>
                  <p>Rode os modelos para comparar candidatos, revisar diagnósticos e aprovar a equação.</p>
                </div>
                <button className="btn primary" disabled={status === "running"} onClick={runModeling}>
                  <Play className="icon" />
                  {status === "running" ? "Rodando" : "Rodar modelos"}
                </button>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="report"
            title="Relatório"
            description="Snapshot imutável do modelo aprovado e saída para revisão ou PDF."
            icon={<FileText className="icon" />}
            expanded={expandedSections.report}
            onToggle={() => setSectionExpanded("report", !expandedSections.report)}
          >
            {approvedCandidate ? (
              <div className="card inner-box report-box">
                <div className="panel-header">
                  <div>
                    <h3>Relatório</h3>
                    <p>Snapshot imutável do modelo aprovado.</p>
                  </div>
                  <FileText className="icon" />
                </div>
                <div className="button-row">
                  <button className="btn primary" onClick={generateReport} disabled={status === "reporting"}>
                    <FileText className="icon" />
                    {status === "reporting" ? "Gerando" : "Gerar snapshot"}
                  </button>
                  <button className="btn" onClick={downloadReport} disabled={!report}>
                    <FileDown className="icon" />
                    Baixar HTML
                  </button>
                  <button className="btn" onClick={printReport} disabled={!report}>
                    <FileDown className="icon" />
                    Imprimir/PDF
                  </button>
                </div>
                {report ? (
                  <div className="report" style={{ marginTop: 14 }}>
                    <h2>{project.name}</h2>
                    <p>
                      {subject.address} - {subject.city}/{subject.state}
                    </p>
                    <p>
                      Valor estimado: <strong>{formatCurrency(approvedCandidate.valuation?.estimate)}</strong>
                    </p>
                    <p>
                      Intervalo: {formatCurrency(approvedCandidate.valuation?.lower)} a{" "}
                      {formatCurrency(approvedCandidate.valuation?.upper)}
                    </p>
                    <div className="equation">{approvedCandidate.equation}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <h3>Relatório pendente</h3>
                  <p>Aprove um modelo aceito para gerar o snapshot e exportar o relatório.</p>
                </div>
                <FileText className="icon" />
              </div>
            )}
          </CollapsibleSection>
        </section>
        <CriteriaModal
          check={analyzedCheck}
          candidate={selectedCandidate}
          valuation={selectedCandidate?.valuation}
          onClose={() => setAnalyzedCheck(null)}
        />

        {scoreBreakdownCandidate && scoreBreakdownCandidate.scoreBreakdown && (
          <div className="modal-backdrop" onClick={() => setScoreBreakdownCandidate(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
              <div className="modal-header">
                <h2>Composição do Score</h2>
                <button className="icon-button" onClick={() => setScoreBreakdownCandidate(null)}>
                  <XCircle className="icon" />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: "1rem" }}>
                  Score total do modelo: <strong>{formatNumber(scoreBreakdownCandidate.scoreBreakdown.total, 1)}</strong>
                </p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fator</th>
                      <th className="align-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Base (R² aj. e RMSE)</td>
                      <td className="align-right">{formatNumber(scoreBreakdownCandidate.scoreBreakdown.base, 4)}</td>
                    </tr>
                    {scoreBreakdownCandidate.scoreBreakdown.acceptanceBonus !== 0 && (
                      <tr>
                        <td>Bônus de Aceitação</td>
                        <td className="align-right">{formatNumber(scoreBreakdownCandidate.scoreBreakdown.acceptanceBonus, 4)}</td>
                      </tr>
                    )}
                    {scoreBreakdownCandidate.scoreBreakdown.intervalPenalty !== 0 && (
                      <tr>
                        <td>Penalidade de Intervalo</td>
                        <td className="align-right">{formatNumber(-scoreBreakdownCandidate.scoreBreakdown.intervalPenalty, 4)}</td>
                      </tr>
                    )}
                    {scoreBreakdownCandidate.scoreBreakdown.complexityPenalty !== 0 && (
                      <tr>
                        <td>Penalidade de Complexidade</td>
                        <td className="align-right">{formatNumber(-scoreBreakdownCandidate.scoreBreakdown.complexityPenalty, 4)}</td>
                      </tr>
                    )}
                    {scoreBreakdownCandidate.scoreBreakdown.vifPenalty !== 0 && (
                      <tr>
                        <td>Penalidade VIF</td>
                        <td className="align-right">{formatNumber(-scoreBreakdownCandidate.scoreBreakdown.vifPenalty, 4)}</td>
                      </tr>
                    )}
                    {scoreBreakdownCandidate.scoreBreakdown.informationPenalty !== 0 && (
                      <tr>
                        <td>Penalidade AIC</td>
                        <td className="align-right">{formatNumber(-scoreBreakdownCandidate.scoreBreakdown.informationPenalty, 4)}</td>
                      </tr>
                    )}
                    {scoreBreakdownCandidate.scoreBreakdown.warningsPenalty !== 0 && (
                      <tr>
                        <td>Penalidade Alertas (Regras)</td>
                        <td className="align-right">{formatNumber(-scoreBreakdownCandidate.scoreBreakdown.warningsPenalty, 4)}</td>
                      </tr>
                    )}
                    {scoreBreakdownCandidate.scoreBreakdown.failedChecksPenalty !== 0 && (
                      <tr>
                        <td>Penalidade Falhas (Regras)</td>
                        <td className="align-right">{formatNumber(-scoreBreakdownCandidate.scoreBreakdown.failedChecksPenalty, 4)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer" style={{ justifyContent: "flex-end", marginTop: "16px" }}>
                <button className="button" onClick={() => setScoreBreakdownCandidate(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function isErrorPayload(payload: unknown): payload is { error: string } {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string";
}

function CollapsibleSection({
  id,
  title,
  description,
  icon,
  expanded,
  onToggle,
  children
}: {
  id: SectionId;
  title: string;
  description: string;
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = `${id}-content`;

  return (
    <section className={`panel collapsible-section anchor-section ${expanded ? "is-expanded" : ""}`} id={id} tabIndex={-1}>
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="collapsible-header"
        onClick={onToggle}
        type="button"
      >
        <span className="collapsible-copy">
          <span className="collapsible-title">
            {expanded ? <ChevronDown className="icon" /> : <ChevronRight className="icon" />}
            <span>{title}</span>
          </span>
          <span className="collapsible-description">{description}</span>
        </span>
        <span className="collapsible-icon">{icon}</span>
      </button>

      {expanded ? (
        <div className="collapsible-content" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ModelDetail({
  candidate,
  approved,
  onApprove,
  onAnalyzeCheck
}: {
  candidate: CandidateModel | null;
  approved: boolean;
  onApprove: () => void;
  onAnalyzeCheck: (check: RulePackCheck) => void;
}) {
  if (!candidate) {
    return (
      <div className="panel inner-box">
        <h2>Detalhe do modelo</h2>
      </div>
    );
  }

  return (
    <div className="panel inner-box">
      <div className="panel-header">
        <div>
          <h2>Detalhe do modelo</h2>
          <p>{candidate.accepted ? "Pronto para aprovação técnica." : candidate.rejectionReasons.join(" ")}</p>
        </div>
        <button className="btn primary" disabled={!candidate.accepted || approved} onClick={onApprove}>
          <CheckCircle2 className="icon" />
          {approved ? "Aprovado" : "Aprovar"}
        </button>
      </div>

      <div className="metrics-grid">
        <Metric label="Valor" value={formatCurrency(candidate.valuation?.estimate)} />
        <Metric label="R² ajustado" value={formatNumber(candidate.diagnostics.adjustedR2, 3)} />
        <Metric label="p global" value={formatNumber(candidate.diagnostics.fPValue, 4)} />
        <Metric label="VIF máx." value={formatNumber(candidate.diagnostics.maxVif, 2)} />
      </div>

      <div style={{ height: 14 }} />
      <div className="equation">{candidate.equation}</div>

      <div style={{ height: 14 }} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coeficiente</th>
              <th>Estimativa</th>
              <th>Erro padrão</th>
              <th>t</th>
              <th>p-valor</th>
            </tr>
          </thead>
          <tbody>
            {candidate.coefficients.map((coefficient) => (
              <tr key={coefficient.term}>
                <td>{coefficient.label}</td>
                <td>{formatNumber(coefficient.estimate, 4)}</td>
                <td>{formatNumber(coefficient.standardError, 4)}</td>
                <td>{formatNumber(coefficient.tStatistic, 3)}</td>
                <td>{formatNumber(coefficient.pValue, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ height: 14 }} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Critério</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Limite</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {candidate.ruleChecks.map((check) => (
              <tr key={check.id}>
                <td>
                  <strong>{check.label}</strong>
                  <br />
                  <span>{check.message}</span>
                </td>
                <td>
                  <span className={check.status === "pass" ? "status-pill success" : "status-pill warn"}>{check.status}</span>
                </td>
                <td>{check.value ?? "-"}</td>
                <td>{check.threshold ?? "-"}</td>
                <td>
                  <button className="btn" onClick={() => onAnalyzeCheck(check)}>Analisar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
