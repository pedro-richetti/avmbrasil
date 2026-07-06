"use client";

import type { CandidateModel, RulePackCheck, ValuationInterval } from "@avm/domain";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line } from "recharts";

interface CriteriaModalProps {
  check: RulePackCheck | null;
  candidate: CandidateModel | null;
  valuation: ValuationInterval | undefined;
  onClose: () => void;
}

export function CriteriaModal({ check, candidate, valuation, onClose }: CriteriaModalProps) {
  if (!check || !candidate) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#fff', borderRadius: 8, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 0
      }}>
        <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{check.label}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className={check.status === "pass" ? "status-pill success" : "status-pill warn"} style={{ margin: 0 }}>
                {check.status === "pass" ? <CheckCircle2 className="icon" size={14}/> : <AlertTriangle className="icon" size={14}/>}
                {check.status}
              </span>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Limiar: {check.threshold}</span>
            </div>
          </div>
          <button className="nav-action" onClick={onClose} style={{ padding: 4 }}><X size={24} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{ marginBottom: 24, fontSize: '1rem', color: '#374151' }}>{check.message}</p>
          <CriteriaContent check={check} candidate={candidate} valuation={valuation} />
        </div>
      </div>
    </div>
  );
}

function CriteriaContent({ check, candidate, valuation }: { check: RulePackCheck, candidate: CandidateModel, valuation: ValuationInterval | undefined }) {
  const extra = candidate.extraDiagnostics;
  if (!extra) return <div className="empty-state">Sem dados extras disponíveis.</div>;

  switch (check.id) {
    case "variables-used":
    case "observations-used":
    case "degrees-of-freedom":
    case "observation-parameter-ratio":
      return (
        <div className="metrics-grid">
          <div className="metric-box">
            <span>Observações (n)</span>
            <strong>{extra.n}</strong>
          </div>
          <div className="metric-box">
            <span>Variáveis (p)</span>
            <strong>{extra.p}</strong>
          </div>
          <div className="metric-box">
            <span>Graus de Liberdade</span>
            <strong>{extra.degreesOfFreedom}</strong>
          </div>
          <div className="metric-box">
            <span>Razão (n/p)</span>
            <strong>{formatNumber(extra.n / extra.p)}</strong>
          </div>
        </div>
      );
    case "duplicate-data":
      return (
        <div>
          {extra.duplicateData.length > 0 ? (
            <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
              {extra.duplicateData.map(d => <li key={d}>{d}</li>)}
            </ul>
          ) : <p>Nenhum dado duplicado encontrado.</p>}
        </div>
      );
    case "stale-data":
      return (
        <div>
          {extra.staleData.length > 0 ? (
            <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
              {extra.staleData.map(d => <li key={d}>{d}</li>)}
            </ul>
          ) : <p>Nenhum dado obsoleto encontrado.</p>}
        </div>
      );
    case "essential-variables-tested":
      return (
        <div>
          {extra.missingEssentialVariables.length > 0 ? (
            <div>
              <p>Variáveis ausentes:</p>
              <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
                {extra.missingEssentialVariables.map(d => <li key={d}>{d}</li>)}
              </ul>
            </div>
          ) : <p>Todas as variáveis essenciais estão presentes.</p>}
        </div>
      );
    case "micronumerosity":
      return (
        <div>
          {extra.micronumerosityViolations.length > 0 ? (
            <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
              {extra.micronumerosityViolations.map(d => <li key={d}>{d}</li>)}
            </ul>
          ) : <p>Não há violações de micronumerosidade.</p>}
        </div>
      );
    case "r2-minimum":
      return (
        <div className="metrics-grid">
          <div className="metric-box">
            <span>R²</span>
            <strong>{formatNumber(extra.r2)}</strong>
          </div>
        </div>
      );
    case "global-significance":
      return (
        <div className="metrics-grid">
          <div className="metric-box">
            <span>Estatística F</span>
            <strong>{formatNumber(extra.fStatistic)}</strong>
          </div>
          <div className="metric-box">
            <span>p-valor F</span>
            <strong>{formatNumber(extra.fPValue)}</strong>
          </div>
        </div>
      );
    case "residual-normality":
      return (
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Banda</th><th>% Obtida</th><th>Mínimo</th><th>Máximo</th></tr>
              </thead>
              <tbody>
                {extra.studentizedResidualsBands.map(b => (
                  <tr key={b.label}>
                    <td>{b.label}</td>
                    <td>{formatPercent(b.percent / 100)}</td>
                    <td>{formatPercent(b.min / 100)}</td>
                    <td>{formatPercent(b.max / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ResidualNormalityChart residuals={candidate.diagnosticPoints.map(p => p.residual)} />
        </div>
      );
    case "term-significance":
    case "student-t-dominance":
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Variável</th><th>T de Student</th><th>Significância</th></tr>
            </thead>
            <tbody>
              {extra.termTStatistics.map(t => (
                <tr key={t.label} style={{ fontWeight: extra.tStudentDominant === t.label ? 'bold' : 'normal' }}>
                  <td>{t.label} {extra.tStudentDominant === t.label && "(Dominante)"}</td>
                  <td>{formatNumber(t.value)}</td>
                  <td>{formatPercent(t.pValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "expected-signs":
      return (
        <div>
          {extra.expectedSignViolations.length > 0 ? (
            <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
              {extra.expectedSignViolations.map(d => <li key={d}>{d}</li>)}
            </ul>
          ) : <p>Todos os sinais esperados estão corretos.</p>}
        </div>
      );
    case "heteroscedasticity":
      return (
        <div className="metrics-grid">
          <div className="metric-box">
            <span>R² de Tendência</span>
            <strong>{formatNumber(extra.heteroscedasticityR2)}</strong>
          </div>
        </div>
      );
    case "max-relative-residual":
    case "max-linear-residual-variation":
      return (
        <div className="metrics-grid">
          <div className="metric-box">
            <span>Máx Resíduo Relativo</span>
            <strong>{formatPercent(extra.maxRelativeResidual / 100)}</strong>
          </div>
        </div>
      );
    case "multicollinearity-vif":
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Variável</th><th>VIF</th></tr>
            </thead>
            <tbody>
              {extra.vifs.map(v => (
                <tr key={v.label}>
                  <td>{v.label}</td>
                  <td>{formatNumber(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "independent-strong-correlation":
    case "dependent-strong-correlation":
      return (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Var</th>
                {extra.correlationMatrix.labels.map(l => <th key={l}>{l.substring(0,6)}...</th>)}
              </tr>
            </thead>
            <tbody>
              {extra.correlationMatrix.matrix.map((row, i) => (
                <tr key={i}>
                  <td><strong>{extra.correlationMatrix.labels[i]?.substring(0,6)}...</strong></td>
                  {row.map((val, j) => (
                    <td key={j} style={{ backgroundColor: Math.abs(val) > 0.8 && i !== j ? '#fee2e2' : 'transparent' }}>
                      {formatNumber(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "projection-inflection":
      return (
        <div>
          {extra.projectionInflexionTerms.length > 0 ? (
            <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
              {extra.projectionInflexionTerms.map(d => <li key={d}>{d}</li>)}
            </ul>
          ) : <p>Nenhum termo com risco de inflexão.</p>}
        </div>
      );
    case "projection-interval-amplitude":
    case "projection-extrapolation":
      return (
        <div className="metrics-grid">
          <div className="metric-box">
            <span>Amplitude (Intervalo)</span>
            <strong>{valuation ? formatPercent(Math.abs((valuation.upper - valuation.lower) / valuation.estimate)) : "N/A"}</strong>
          </div>
        </div>
      );
    case "cook-distance-over-one":
    case "influence":
    case "studentized-residuals":
      return <DiagnosticChart checkId={check.id} candidate={candidate} />;
    default:
      return <p>Nenhum detalhe adicional configurado.</p>;
  }
}

function ResidualNormalityChart({ residuals }: { residuals: number[] }) {
  if (residuals.length === 0) return null;

  const min = Math.min(...residuals);
  const max = Math.max(...residuals);

  // If min == max, we can't really make 6 meaningful bins
  const w = max > min ? (max - min) / 6 : 1;
  const start = max > min ? min : min - 3;

  const bins = Array.from({ length: 6 }, (_, i) => ({
    min: start + i * w,
    max: start + (i + 1) * w,
    mid: start + (i + 0.5) * w,
    count: 0
  }));

  residuals.forEach(r => {
    let binIdx = Math.floor((r - start) / w);
    if (binIdx >= 6) binIdx = 5;
    if (binIdx < 0) binIdx = 0;
    const bin = bins[binIdx];
    if (bin) {
      bin.count++;
    }
  });

  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance = residuals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / residuals.length;
  const stdDev = Math.sqrt(variance);

  const N = residuals.length;

  const normalDensity = (x: number) => {
    if (stdDev === 0) return 0;
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
  };

  const data = bins.map(b => {
    const normalFreq = stdDev > 0 ? normalDensity(b.mid) * N * w : 0;
    return {
      name: `${formatNumber(b.min)} a ${formatNumber(b.max)}`,
      mid: b.mid,
      Frequência: b.count,
      'Curva Normal': normalFreq
    };
  });

  return (
    <div style={{ height: 300, width: '100%', marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
          <Bar dataKey="Frequência" fill="blue" />
          <Line type="monotone" dataKey="Curva Normal" stroke="green" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DiagnosticChart({ checkId, candidate }: { checkId: string; candidate: CandidateModel }) {
  const points = candidate.diagnosticPoints;
  const isResiduals = checkId === "studentized-residuals";

  const chartData = points.map(p => ({
    index: p.index + 1,
    fitted: p.fitted,
    studentizedResidual: p.studentizedResidual,
    cooksDistance: p.cooksDistance,
  }));

  const yAxisDataKey = isResiduals ? "studentizedResidual" : "cooksDistance";
  const xAxisDataKey = isResiduals ? "fitted" : "index";
  const yAxisLabel = isResiduals ? "Resíduo Studentizado" : "Distância de Cook";
  const xAxisLabel = isResiduals ? "Valor Ajustado" : "Índice (n)";
  const scatterColor = isResiduals ? "#0f766e" : "#b45309";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ height: 300, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey={xAxisDataKey}
              name={xAxisLabel}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number"
              dataKey={yAxisDataKey}
              name={yAxisLabel}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            />
            <Scatter name={yAxisLabel} data={chartData} fill={scatterColor} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Índice</th>
              <th>Valor Ajustado</th>
              <th>Resíduo Studentizado</th>
              <th>Distância de Cook</th>
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.index}>
                <td>{p.index + 1}</td>
                <td>{formatNumber(p.fitted)}</td>
                <td>{formatNumber(p.studentizedResidual)}</td>
                <td>{formatNumber(p.cooksDistance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
