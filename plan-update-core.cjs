const fs = require('fs');
let code = fs.readFileSync('packages/valuation-core/src/index.ts', 'utf8');

// The evaluateDraftRules signature and return modification
code = code.replace(
  `function evaluateDraftRules(
  fit: FittedModel,
  valuation: ValuationInterval | undefined,
  subjectValues: SubjectProperty["values"] | undefined,
  thresholds: DraftRuleThresholds = defaultDraftThresholds
): RulePackCheck[] {`,
  `function evaluateDraftRules(
  fit: FittedModel,
  valuation: ValuationInterval | undefined,
  subjectValues: SubjectProperty["values"] | undefined,
  thresholds: DraftRuleThresholds = defaultDraftThresholds
) {`
);

code = code.replace(
  `  return checks;
}`,
  `  return {
    checks,
    extraDiagnostics: {
      n: fit.n,
      p: fit.p,
      degreesOfFreedom,
      duplicateData: duplicateSummary.examples,
      staleData: staleSummary.staleIds || [],
      missingEssentialVariables: essentialSummary.missing,
      micronumerosityViolations: micronumerosity.violations,
      r2: fit.diagnostics.r2,
      fStatistic: fit.diagnostics.fStatistic,
      fPValue: fit.diagnostics.fPValue,
      studentizedResidualsBands: normality.bands || [],
      termTStatistics: fit.termCoefficients.filter((c) => c.term !== "intercept").map(c => ({ label: c.label, value: c.tStatistic })),
      tStudentDominant: tDominance.dominantLabel || null,
      expectedSignViolations: signIssues,
      heteroscedasticityR2: heteroscedasticity.r2,
      maxRelativeResidual: relativeResidual.percent,
      vifs: [], // will fix later
      correlationMatrix: { labels: [], matrix: [] }, // will fix later
      projectionInflexionTerms: inflexionRisk.terms
    }
  };
}`
);

fs.writeFileSync('packages/valuation-core/src/index.ts', code);
