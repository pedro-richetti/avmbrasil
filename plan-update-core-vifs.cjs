const fs = require('fs');
let code = fs.readFileSync('packages/valuation-core/src/index.ts', 'utf8');

// I need to update evaluateDraftRules to calculate VIFs properly.
code = code.replace(
  `      vifs: [], // will fix later`,
  `      vifs: calculateVif(fit.x).slice(1).map((value, idx) => ({ label: fit.terms[idx]?.label ?? \`x\${idx+1}\`, value })),`
);
code = code.replace(
  `      correlationMatrix: { labels: [], matrix: [] }, // will fix later`,
  `      correlationMatrix: calculateCorrelationMatrix(fit.x, fit.terms),`
);

code = code.replace(
  `function staleObservationSummary(fit: FittedModel): { status: RulePackCheck["status"]; message: string; value: string } {`,
  `function staleObservationSummary(fit: FittedModel): { status: RulePackCheck["status"]; message: string; value: string; staleIds?: string[] } {`
);
code = code.replace(
  `  return {
    status: stale.length === 0 ? "pass" : "fail",
    message:`,
  `  return {
    staleIds: stale.map(item => item.id),
    status: stale.length === 0 ? "pass" : "fail",
    message:`
);

code = code.replace(
  `function residualNormalitySummary(fit: FittedModel): { passed: boolean; value: string; message: string } {`,
  `function residualNormalitySummary(fit: FittedModel): { passed: boolean; value: string; message: string; bands: Array<{ label: string; percent: number; min: number; max: number }> } {`
);
code = code.replace(
  `  return {
    passed: failed.length === 0,
    value: values.map((item) => \`\${item.label}: \${formatPercent(item.percent)}\`).join("; "),
    message:`,
  `  return {
    bands: values,
    passed: failed.length === 0,
    value: values.map((item) => \`\${item.label}: \${formatPercent(item.percent)}\`).join("; "),
    message:`
);

code = code.replace(
  `function studentTDominanceSummary(fit: FittedModel): { dominant: boolean; value: string; message: string } {`,
  `function studentTDominanceSummary(fit: FittedModel): { dominant: boolean; value: string; message: string; dominantLabel?: string } {`
);
code = code.replace(
  `  return {
    dominant,
    value: max ? \`\${max.label}: \${round(max.value, 3)} / demais \${round(othersSum, 3)}\` : "n/a",
    message:`,
  `  return {
    dominant,
    dominantLabel: dominant && max ? max.label : undefined,
    value: max ? \`\${max.label}: \${round(max.value, 3)} / demais \${round(othersSum, 3)}\` : "n/a",
    message:`
);

code = code.replace(
  `    const ruleChecks = evaluateDraftRules(fit, valuation, input.subjectValues);`,
  `    const { checks: ruleChecks, extraDiagnostics } = evaluateDraftRules(fit, valuation, input.subjectValues);`
);

code = code.replace(
  `      diagnostics: fit.diagnostics,
      diagnosticPoints: fit.diagnosticPoints
    };`,
  `      diagnostics: fit.diagnostics,
      diagnosticPoints: fit.diagnosticPoints,
      extraDiagnostics
    };`
);

fs.writeFileSync('packages/valuation-core/src/index.ts', code);
