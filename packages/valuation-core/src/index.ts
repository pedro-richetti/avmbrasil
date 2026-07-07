import type {
  CandidateModel,
  DataValue,
  DiagnosticPoint,
  DiagnosticSummary,
  ExpectedSign,
  MarketComparable,
  ModelRun,
  RulePack,
  RulePackCheck,
  ScoreBreakdown,
  SubjectProperty,
  TermCoefficient,
  TransformKind,
  ValuationInterval,
  VariableDefinition,
  VariableKind
} from "@avm/domain";

export interface ModelSearchInput {
  comparables: MarketComparable[];
  variables: VariableDefinition[];
  subjectValues?: SubjectProperty["values"];
  targetVariableId?: string;
  rulePack?: RulePack;
  minVariables?: number;
  maxVariables?: number;
  maxCombinations?: number;
  autoTransformSearch?: boolean;
  maxTransformCandidatesPerVariable?: number;
  autoTargetTransformSearch?: boolean;
  maxTargetTransformCandidates?: number;
}

export interface DraftRuleThresholds {
  minObservations: number;
  minObservationToParameterRatio: number;
  maxIndividualPValue: number;
  maxGlobalPValue: number;
  maxVif: number;
  minAdjustedR2: number;
  minR2: number;
  maxAbsStudentizedResidual: number;
  cooksDistanceMultiplier: number;
  maxStrongCorrelation: number;
  maxHeteroscedasticityR2: number;
  maxProjectionIntervalAmplitudePercent: number;
}

interface DesignTerm {
  key: string;
  label: string;
  variableId: string;
  sourceField: string;
  transform: TransformKind;
  expectedSign: ExpectedSign;
  category?: string;
}

interface VariableCandidateGroup {
  required: boolean;
  variants: VariableDefinition[];
}

interface FittedModel {
  id: string;
  terms: DesignTerm[];
  target: VariableDefinition;
  observations: FittedObservation[];
  n: number;
  p: number;
  x: number[][];
  y: number[];
  coefficients: number[];
  covariance: number[][];
  fitted: number[];
  residuals: number[];
  xtxInverse: number[][];
  sigma2: number;
  diagnostics: DiagnosticSummary;
  diagnosticPoints: DiagnosticPoint[];
  termCoefficients: TermCoefficient[];
}

interface FittedObservation {
  comparable: MarketComparable;
  x: number[];
  y: number;
  fitted: number;
  residual: number;
  originalTargetValue: number;
  originalFittedValue: number;
}

const EPSILON = 1e-10;
const FEATURE_TRANSFORMS: TransformKind[] = ["none", "log", "sqrt", "square", "inverse"];
const TARGET_TRANSFORMS: TransformKind[] = ["none", "log", "sqrt", "square", "inverse"];

export const draftNbr14653RulePack: RulePack = {
  id: "nbr-14653-2-draft-mvp",
  name: "NBR 14653-2 MVP draft checks",
  version: "0.1.0",
  standardReference: "ABNT NBR 14653-2, thresholds pending licensed confirmation",
  status: "draft",
  notes:
    "Draft engineering checks for MVP validation only. Confirm exact thresholds and report language from licensed ABNT material before claiming compliance."
};

export const defaultDraftThresholds: DraftRuleThresholds = {
  minObservations: 12,
  minObservationToParameterRatio: 3,
  maxIndividualPValue: 0.3,
  maxGlobalPValue: 0.05,
  maxVif: 10,
  minAdjustedR2: 0,
  minR2: 0.6,
  maxAbsStudentizedResidual: 3,
  cooksDistanceMultiplier: 4,
  maxStrongCorrelation: 0.8,
  maxHeteroscedasticityR2: 0.25,
  maxProjectionIntervalAmplitudePercent: 50
};

export function runModelSearch(input: ModelSearchInput): ModelRun {
  const rulePack = input.rulePack ?? draftNbr14653RulePack;
  const target = resolveTargetVariable(input.variables, input.targetVariableId);
  const featureVariables = input.variables.filter((variable) => variable.role === "feature");
  const minVariables = input.minVariables ?? 1;
  const maxVariables = Math.min(input.maxVariables ?? 5, featureVariables.length);
  const maxCombinations = input.maxCombinations ?? 240;
  const targetCandidates = buildTargetCandidates({
    comparables: input.comparables,
    target,
    featureVariables,
    autoTargetTransformSearch: input.autoTargetTransformSearch ?? true,
    maxTargetTransformCandidates: input.maxTargetTransformCandidates ?? 2
  });
  const maxCombinationsPerTarget = Math.max(1, Math.ceil(maxCombinations / Math.max(targetCandidates.length, 1)));
  const candidates = targetCandidates.flatMap((targetCandidate) => {
    const variableGroups = buildVariableCandidateGroups({
      comparables: input.comparables,
      target: targetCandidate,
      featureVariables,
      autoTransformSearch: input.autoTransformSearch ?? true,
      maxTransformCandidatesPerVariable: input.maxTransformCandidatesPerVariable ?? 2
    });
    const combinations = variableCombinations(variableGroups, minVariables, maxVariables, maxCombinationsPerTarget);

    return combinations.map((variables) => {
      const candidateInput: {
        comparables: MarketComparable[];
        variables: VariableDefinition[];
        target: VariableDefinition;
        subjectValues?: SubjectProperty["values"];
        rulePack: RulePack;
      } = {
        comparables: input.comparables,
        variables,
        target: targetCandidate,
        rulePack
      };

      if (input.subjectValues) {
        candidateInput.subjectValues = input.subjectValues;
      }

      return buildCandidate(candidateInput);
    });
  });

  candidates.sort((left, right) => {
    if (left.accepted !== right.accepted) {
      return left.accepted ? -1 : 1;
    }

    return right.score - left.score;
  });

  const selectedCandidate = candidates.find((candidate) => candidate.accepted);
  const modelRun: ModelRun = {
    id: stableId(
      "run",
      JSON.stringify({
        target: target.id,
        targetTransforms: targetCandidates.map((candidate) => candidate.transform),
        variables: input.variables,
        rows: input.comparables.length
      })
    ),
    createdAt: new Date().toISOString(),
    rulePack,
    candidates
  };

  if (selectedCandidate) {
    modelRun.selectedCandidateId = selectedCandidate.id;
  }

  return modelRun;
}

export function inferVariableKind(values: DataValue[]): VariableKind {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== "");

  if (nonEmpty.length === 0) {
    return "categorical";
  }

  const numericCount = nonEmpty.filter((value) => coerceNumber(value) !== null).length;
  const booleanCount = nonEmpty.filter((value) => isBooleanLike(value)).length;
  const uniqueValues = new Set(nonEmpty.map(normalizedValueKey));
  const numericRatio = numericCount / nonEmpty.length;
  const booleanRatio = booleanCount / nonEmpty.length;

  if (uniqueValues.size <= 2 && (booleanRatio >= 0.8 || numericRatio >= 0.8 || nonEmpty.length >= 4)) {
    return "binary";
  }

  if (numericRatio >= 0.85) {
    return "numeric";
  }

  return "categorical";
}

function buildCandidate(input: {
  comparables: MarketComparable[];
  variables: VariableDefinition[];
  target: VariableDefinition;
  subjectValues?: SubjectProperty["values"];
  rulePack: RulePack;
}): CandidateModel {
  const terms = createTerms(input.comparables, input.variables);
  const candidateId = stableId("model", `${input.target.id}:${input.target.transform}:${terms.map((term) => term.key).join("|")}`);

  try {
    const fit = fitLinearModel(input.comparables, input.target, terms);
    const valuation = input.subjectValues ? predictSubjectValue(fit, input.subjectValues) : undefined;
    const { checks: ruleChecks, extraDiagnostics } = evaluateDraftRules(fit, valuation, input.subjectValues);
    const rejectionReasons = ruleChecks.filter((check) => check.status === "fail").map((check) => check.message);
    const accepted = rejectionReasons.length === 0;
    const { total: score, breakdown: scoreBreakdown } = scoreCandidate(fit, accepted, valuation, ruleChecks);
    const candidate: CandidateModel = {
      id: candidateId,
      equation: formatEquation(input.target, fit),
      terms: terms.map((term) => term.key),
      accepted,
      score,
      rejectionReasons,
      ruleChecks,
      coefficients: fit.termCoefficients,
      diagnostics: fit.diagnostics,
      diagnosticPoints: fit.diagnosticPoints,
      extraDiagnostics,
      scoreBreakdown
    };

    if (valuation) {
      candidate.valuation = valuation;
    }

    return candidate;
  } catch (error) {
    return {
      id: candidateId,
      equation: formatTermList(input.target, terms),
      terms: terms.map((term) => term.key),
      accepted: false,
      score: -10_000,
      rejectionReasons: [error instanceof Error ? error.message : "Modelo inválido"],
      ruleChecks: [
        makeCheck({
          id: "fit",
          label: "Ajuste do modelo",
          status: "fail",
          message: error instanceof Error ? error.message : "Modelo inválido"
        })
      ],
      coefficients: [],
      diagnostics: emptyDiagnostics(),
      diagnosticPoints: []
    };
  }
}

export function fitLinearModel(comparables: MarketComparable[], target: VariableDefinition, terms: DesignTerm[]): FittedModel {
  const x: number[][] = [];
  const y: number[] = [];
  const validComparables: MarketComparable[] = [];

  for (const comparable of comparables) {
    const targetValue = transformedNumber(comparable.values[target.sourceField], target.transform);
    const row = terms.map((term) => termValue(comparable.values, term));

    if (targetValue === null || row.some((value) => value === null)) {
      continue;
    }

    x.push([1, ...(row as number[])]);
    y.push(targetValue);
    validComparables.push(comparable);
  }

  const n = x.length;
  const p = terms.length + 1;

  if (n <= p) {
    throw new Error(`Amostra insuficiente para ${terms.length} variável(is): ${n} observações válidas e ${p} parâmetros.`);
  }

  const xt = transpose(x);
  const xtx = multiplyMatrices(xt, x);
  const xtxInverse = inverse(xtx);
  const xty = multiplyMatrixVector(xt, y);
  const coefficients = multiplyMatrixVector(xtxInverse, xty);
  const fitted = x.map((row) => dot(row, coefficients));
  const residuals = y.map((value, index) => value - (fitted[index] ?? 0));
  const sse = residuals.reduce((sum, residual) => sum + residual * residual, 0);
  const yMean = average(y);
  const sst = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const dfResidual = n - p;
  const sigma2 = sse / dfResidual;
  const covariance = xtxInverse.map((row) => row.map((value) => value * sigma2));
  const r2 = sst <= EPSILON ? 1 : 1 - sse / sst;
  const adjustedR2 = 1 - (1 - r2) * ((n - 1) / dfResidual);
  const rmse = Math.sqrt(sse / n);
  const aic = n * Math.log(Math.max(sse / n, EPSILON)) + 2 * p;
  const bic = n * Math.log(Math.max(sse / n, EPSILON)) + p * Math.log(n);
  const modelDf = Math.max(p - 1, 1);
  const fStatistic = ((sst - sse) / modelDf) / Math.max(sigma2, EPSILON);
  const fPValue = fDistributionSurvival(fStatistic, modelDf, dfResidual);
  const leverage = x.map((row) => dot(row, multiplyMatrixVector(xtxInverse, row)));
  const studentizedResiduals = residuals.map((residual, index) => {
    const h = clamp(leverage[index] ?? 0, 0, 1 - EPSILON);
    return residual / Math.sqrt(Math.max(sigma2 * (1 - h), EPSILON));
  });
  const cooksDistances = residuals.map((residual, index) => {
    const h = clamp(leverage[index] ?? 0, 0, 1 - EPSILON);
    return ((residual * residual) / Math.max(p * sigma2, EPSILON)) * (h / Math.max((1 - h) ** 2, EPSILON));
  });
  const diagnosticPoints: DiagnosticPoint[] = residuals.map((residual, index) => ({
    index,
    fitted: fitted[index] ?? 0,
    residual,
    studentizedResidual: studentizedResiduals[index] ?? 0,
    cooksDistance: cooksDistances[index] ?? 0
  }));
  const observations: FittedObservation[] = x.map((row, index) => {
    const transformedY = y[index] ?? 0;
    const transformedFitted = fitted[index] ?? 0;

    return {
      comparable: validComparables[index] ?? { id: `obs-${index}`, values: {} },
      x: row,
      y: transformedY,
      fitted: transformedFitted,
      residual: residuals[index] ?? 0,
      originalTargetValue: inverseTransform(transformedY, target.transform),
      originalFittedValue: inverseTransform(transformedFitted, target.transform)
    };
  });
  const vifs = calculateVif(x);
  const termCoefficients = coefficients.map((estimate, index) => {
    const standardError = Math.sqrt(Math.max(covariance[index]?.[index] ?? 0, EPSILON));
    const tStatistic = estimate / standardError;
    const pValue = twoSidedStudentTPValue(tStatistic, dfResidual);
    const term = index === 0 ? undefined : terms[index - 1];

    return {
      term: term?.key ?? "intercept",
      label: term?.label ?? "Intercepto",
      estimate,
      standardError,
      tStatistic,
      pValue
    };
  });

  return {
    id: stableId("fit", `${target.id}:${terms.map((term) => term.key).join("|")}:${n}`),
    terms,
    target,
    observations,
    n,
    p,
    x,
    y,
    coefficients,
    covariance,
    fitted,
    residuals,
    xtxInverse,
    sigma2,
    diagnostics: {
      r2,
      adjustedR2,
      rmse,
      aic,
      bic,
      fStatistic,
      fPValue,
      maxVif: Math.max(1, ...vifs),
      maxCookDistance: Math.max(0, ...cooksDistances),
      maxAbsStudentizedResidual: Math.max(0, ...studentizedResiduals.map((value) => Math.abs(value)))
    },
    diagnosticPoints,
    termCoefficients
  };
}

function evaluateDraftRules(
  fit: FittedModel,
  valuation: ValuationInterval | undefined,
  subjectValues: SubjectProperty["values"] | undefined,
  thresholds: DraftRuleThresholds = defaultDraftThresholds
) {
  const checks: RulePackCheck[] = [];
  const ratio = fit.n / fit.p;
  const degreesOfFreedom = fit.n - fit.p;
  const featurePValues = fit.termCoefficients.filter((coefficient) => coefficient.term !== "intercept").map((coefficient) => coefficient.pValue);
  const maxPValue = Math.max(0, ...featurePValues);
  const cookThreshold = thresholds.cooksDistanceMultiplier / fit.n;
  const duplicateSummary = duplicateObservationSummary(fit);
  const staleSummary = staleObservationSummary(fit);
  const essentialSummary = essentialVariableCoverage(fit);
  const micronumerosity = micronumerositySummary(fit);
  const normality = residualNormalitySummary(fit);
  const tDominance = studentTDominanceSummary(fit);
  const heteroscedasticity = heteroscedasticitySummary(fit);
  const relativeResidual = maxOriginalRelativeResidualSummary(fit);
  const linearResidualVariation = maxLinearResidualVariationSummary(fit);
  const independentCorrelation = independentCorrelationSummary(fit);
  const dependentCorrelation = dependentCorrelationSummary(fit);
  const inflexionRisk = projectionInflexionRiskSummary(fit);
  const intervalAmplitude = projectionIntervalAmplitudeSummary(valuation);
  const extrapolation = projectionExtrapolationSummary(fit, subjectValues);

  checks.push(
    makeCheck({
      id: "variables-used",
      label: "Quantidade de variáveis utilizadas",
      status: fit.p < fit.n ? "pass" : "fail",
      message: `${fit.p} variável(is) utilizadas contando a dependente.`,
      value: fit.p,
      threshold: `< ${fit.n}`
    })
  );

  checks.push(
    makeCheck({
      id: "observations-used",
      label: "Quantidade de dados utilizados",
      status: fit.n >= thresholds.minObservations ? "pass" : "fail",
      message:
        fit.n >= thresholds.minObservations
          ? `${fit.n} observações válidas.`
          : `Amostra com ${fit.n} observações válidas, abaixo do mínimo preliminar.`,
      value: fit.n,
      threshold: thresholds.minObservations
    })
  );

  checks.push(
    makeCheck({
      id: "degrees-of-freedom",
      label: "Grau de liberdade",
      status: degreesOfFreedom > 0 ? "pass" : "fail",
      message: `Grau de liberdade = ${fit.n} dados - ${fit.p} variáveis/parâmetros = ${degreesOfFreedom}.`,
      value: degreesOfFreedom,
      threshold: "> 0"
    })
  );

  checks.push(
    makeCheck({
      id: "observation-parameter-ratio",
      label: "Relação dados/parâmetros",
      status: ratio >= thresholds.minObservationToParameterRatio ? "pass" : "warn",
      message:
        ratio >= thresholds.minObservationToParameterRatio
          ? `Relação ${ratio.toFixed(2)} observações por parâmetro.`
          : `Relação ${ratio.toFixed(2)} observações por parâmetro, abaixo do mínimo preliminar.`,
      value: round(ratio, 2),
      threshold: thresholds.minObservationToParameterRatio
    })
  );

  checks.push(
    makeCheck({
      id: "duplicate-data",
      label: "Pesquisa: dados repetidos",
      status: duplicateSummary.count === 0 ? "pass" : "fail",
      message:
        duplicateSummary.count === 0
          ? "Não há indícios de dados repetidos na amostra habilitada."
          : `${duplicateSummary.count} possível(is) dado(s) repetido(s): ${duplicateSummary.examples.join(", ")}.`,
      value: duplicateSummary.count,
      threshold: 0
    })
  );

  checks.push(
    makeCheck({
      id: "stale-data",
      label: "Pesquisa: dados com mais de 24 meses",
      status: staleSummary.status,
      message: staleSummary.message,
      value: staleSummary.value,
      threshold: "24 meses"
    })
  );

  checks.push(
    makeCheck({
      id: "essential-variables-tested",
      label: "Variáveis essenciais testadas",
      status: essentialSummary.missing.length === 0 ? "pass" : "warn",
      message:
        essentialSummary.missing.length === 0
          ? "Área, localização, padrão/conservação, vagas e data aparecem representadas no modelo/dados."
          : `Verificar variáveis essenciais ausentes ou não identificadas: ${essentialSummary.missing.join(", ")}.`,
      value: essentialSummary.present.join(", ") || "nenhuma",
      threshold: "área, localização, padrão, conservação, vagas, data"
    })
  );

  checks.push(
    makeCheck({
      id: "micronumerosity",
      label: "Micronumerosidade em dicotômicas/códigos",
      status: micronumerosity.violations.length === 0 ? "pass" : "fail",
      message:
        micronumerosity.violations.length === 0
          ? micronumerosity.checkedGroups === 0
            ? "Sem variáveis dicotômicas/códigos alocados no modelo."
            : "Categorias atendem aos mínimos da Tabela 1."
          : `Micronumerosidade detectada: ${micronumerosity.violations.join("; ")}.`,
      value: micronumerosity.checkedGroups,
      threshold: micronumerosity.threshold
    })
  );

  checks.push(
    makeCheck({
      id: "r2-minimum",
      label: "Coeficiente de determinação",
      status: fit.diagnostics.r2 >= thresholds.minR2 ? "pass" : "fail",
      message:
        fit.diagnostics.r2 >= 0.8
          ? "Coeficiente de determinação preferencial acima de 0,80."
          : fit.diagnostics.r2 >= thresholds.minR2
            ? "Coeficiente acima de 0,60; justificar se ficar entre 0,60 e 0,80."
            : "Coeficiente de determinação abaixo de 0,60.",
      value: round(fit.diagnostics.r2, 4),
      threshold: ">= 0,60; preferível > 0,80"
    })
  );

  checks.push(
    makeCheck({
      id: "global-significance",
      label: "Significância global F-Snedecor",
      status: fit.diagnostics.fPValue <= thresholds.maxGlobalPValue ? "pass" : "fail",
      message:
        fit.diagnostics.fPValue <= thresholds.maxGlobalPValue
          ? "Significância global atende a p <= 0,05."
          : "Significância global insuficiente no teste F-Snedecor.",
      value: round(fit.diagnostics.fPValue, 4),
      threshold: thresholds.maxGlobalPValue
    })
  );

  checks.push(
    makeCheck({
      id: "residual-normality",
      label: "Normalidade dos resíduos",
      status: normality.passed ? "pass" : "warn",
      message: normality.message,
      value: normality.value,
      threshold: "Tabela 2"
    })
  );

  checks.push(
    makeCheck({
      id: "term-significance",
      label: "Significância máxima das variáveis",
      status: maxPValue <= thresholds.maxIndividualPValue ? "pass" : "fail",
      message:
        maxPValue <= thresholds.maxIndividualPValue
          ? "Maior p-valor das variáveis ficou abaixo de 30%."
          : "Uma ou mais variáveis excedem 30% de significância.",
      value: round(maxPValue, 4),
      threshold: thresholds.maxIndividualPValue
    })
  );

  checks.push(
    makeCheck({
      id: "student-t-dominance",
      label: "Dominância de T de Student",
      status: tDominance.dominant ? "warn" : "pass",
      message: tDominance.message,
      value: tDominance.value,
      threshold: "T máx. <= 5x soma dos demais"
    })
  );

  const signIssues = fit.terms.flatMap((term, index) => {
    const coefficient = fit.coefficients[index + 1] ?? 0;
    const expectedSign = adjustedExpectedSignForTargetTransform(term.expectedSign, fit.target.transform);

    if (expectedSign === "positive" && coefficient < 0) {
      return [`${term.label} com sinal negativo.`];
    }

    if (expectedSign === "negative" && coefficient > 0) {
      return [`${term.label} com sinal positivo.`];
    }

    return [];
  });

  checks.push(
    makeCheck({
      id: "expected-signs",
      label: "Expectativas de crescimento",
      status: signIssues.length === 0 ? "pass" : "fail",
      message: signIssues.length === 0 ? "Coeficientes respeitam os sinais esperados." : signIssues.join(" "),
      value: signIssues.length,
      threshold: 0
    })
  );

  checks.push(
    makeCheck({
      id: "heteroscedasticity",
      label: "Heterocedasticidade aparente",
      status: heteroscedasticity.r2 <= thresholds.maxHeteroscedasticityR2 ? "pass" : "warn",
      message: heteroscedasticity.message,
      value: round(heteroscedasticity.r2, 4),
      threshold: `R² tendência <= ${thresholds.maxHeteroscedasticityR2}`
    })
  );

  checks.push(
    makeCheck({
      id: "max-relative-residual",
      label: "Maior resíduo relativo",
      status: relativeResidual.percent <= 80 ? "pass" : "fail",
      message: `${formatPercent(relativeResidual.percent)}: ${relativeResidual.classification}.`,
      value: formatPercent(relativeResidual.percent),
      threshold: "Tabela 3: <= 80%"
    })
  );

  checks.push(
    makeCheck({
      id: "max-linear-residual-variation",
      label: "Maior variação residual linear",
      status: linearResidualVariation.percent <= linearResidualVariation.threshold ? "pass" : "fail",
      message: `${formatPercent(linearResidualVariation.percent)} para GL=${degreesOfFreedom}; limite ${formatPercent(linearResidualVariation.threshold)} pela Tabela 4.`,
      value: formatPercent(linearResidualVariation.percent),
      threshold: formatPercent(linearResidualVariation.threshold)
    })
  );

  checks.push(
    makeCheck({
      id: "cook-distance-over-one",
      label: "Distância de Cook superior a 1",
      status: fit.diagnostics.maxCookDistance <= 1 ? "pass" : "fail",
      message:
        fit.diagnostics.maxCookDistance <= 1
          ? "Nenhum ponto com Distância de Cook superior a 1."
          : "Há ponto com Distância de Cook superior a 1.",
      value: round(fit.diagnostics.maxCookDistance, 4),
      threshold: "<= 1"
    })
  );

  checks.push(
    makeCheck({
      id: "multicollinearity-vif",
      label: "Multicolinearidade por VIF",
      status: fit.diagnostics.maxVif <= thresholds.maxVif ? "pass" : "fail",
      message:
        fit.diagnostics.maxVif <= thresholds.maxVif
          ? `VIF máximo dentro do limite preliminar.`
          : `VIF máximo acima do limite preliminar.`,
      value: round(fit.diagnostics.maxVif, 2),
      threshold: thresholds.maxVif
    })
  );

  checks.push(
    makeCheck({
      id: "independent-strong-correlation",
      label: "Correlação forte entre independentes",
      status: independentCorrelation.maxAbs <= thresholds.maxStrongCorrelation ? "pass" : "warn",
      message: independentCorrelation.message,
      value: round(independentCorrelation.maxAbs, 4),
      threshold: `<= ${thresholds.maxStrongCorrelation}`
    })
  );

  checks.push(
    makeCheck({
      id: "dependent-strong-correlation",
      label: "Correlação forte com a dependente",
      status: dependentCorrelation.maxAbs <= thresholds.maxStrongCorrelation ? "pass" : "warn",
      message: dependentCorrelation.message,
      value: round(dependentCorrelation.maxAbs, 4),
      threshold: `<= ${thresholds.maxStrongCorrelation}`
    })
  );

  checks.push(
    makeCheck({
      id: "projection-inflection",
      label: "Inflexão em gráfico de máximos",
      status: inflexionRisk.risky ? "warn" : "pass",
      message: inflexionRisk.message,
      value: inflexionRisk.terms.join(", ") || "não",
      threshold: "sem indício automático"
    })
  );

  checks.push(
    makeCheck({
      id: "projection-interval-amplitude",
      label: "Amplitude do intervalo de confiança",
      status: intervalAmplitude.status,
      message: intervalAmplitude.message,
      value: intervalAmplitude.value,
      threshold: `${thresholds.maxProjectionIntervalAmplitudePercent}%`
    })
  );

  checks.push(
    makeCheck({
      id: "projection-extrapolation",
      label: "Extrapolação nos valores",
      status: extrapolation.outside.length === 0 ? extrapolation.status : "fail",
      message:
        extrapolation.outside.length === 0
          ? extrapolation.message
          : `Extrapolação detectada: ${extrapolation.outside.join("; ")}.`,
      value: extrapolation.outside.length,
      threshold: 0
    })
  );

  checks.push(
    makeCheck({
      id: "studentized-residuals",
      label: "Resíduos studentizados",
      status: fit.diagnostics.maxAbsStudentizedResidual <= thresholds.maxAbsStudentizedResidual ? "pass" : "warn",
      message:
        fit.diagnostics.maxAbsStudentizedResidual <= thresholds.maxAbsStudentizedResidual
          ? `Resíduos studentizados dentro do limite preliminar.`
          : `Há resíduos studentizados elevados para revisão do engenheiro.`,
      value: round(fit.diagnostics.maxAbsStudentizedResidual, 2),
      threshold: thresholds.maxAbsStudentizedResidual
    })
  );

  checks.push(
    makeCheck({
      id: "influence",
      label: "Pontos influentes",
      status: fit.diagnostics.maxCookDistance <= cookThreshold ? "pass" : "warn",
      message:
        fit.diagnostics.maxCookDistance <= cookThreshold
          ? `Distância de Cook dentro do limite preliminar.`
          : `Há pontos influentes para revisão do engenheiro.`,
      value: round(fit.diagnostics.maxCookDistance, 4),
      threshold: round(cookThreshold, 4)
    })
  );

  return {
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
      termTStatistics: fit.termCoefficients.filter((c) => c.term !== "intercept").map(c => ({ label: c.label, value: c.tStatistic, pValue: c.pValue })),
      tStudentDominant: tDominance.dominantLabel || null,
      expectedSignViolations: signIssues,
      heteroscedasticityR2: heteroscedasticity.r2,
      maxRelativeResidual: relativeResidual.percent,
      vifs: calculateVif(fit.x).slice(1).map((value, idx) => ({ label: fit.terms[idx]?.label ?? `x${idx+1}`, value })),
      correlationMatrix: calculateCorrelationMatrix(fit.x, fit.terms),
      projectionInflexionTerms: inflexionRisk.terms
    }
  };
}

function duplicateObservationSummary(fit: FittedModel): { count: number; examples: string[] } {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const observation of fit.observations) {
    const key = comparableIdentityKey(observation.comparable);
    const prior = seen.get(key);

    if (prior) {
      duplicates.push(`${prior}/${observation.comparable.id}`);
    } else {
      seen.set(key, observation.comparable.id);
    }
  }

  return {
    count: duplicates.length,
    examples: duplicates.slice(0, 3)
  };
}

function comparableIdentityKey(comparable: MarketComparable): string {
  if (comparable.address) {
    return `address:${comparable.address.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`;
  }

  return `values:${JSON.stringify(comparable.values, Object.keys(comparable.values).sort())}`;
}

function staleObservationSummary(fit: FittedModel): { status: RulePackCheck["status"]; message: string; value: string; staleIds?: string[] } {
  const now = Date.now();
  const datedObservations = fit.observations.flatMap((observation) => {
    if (!observation.comparable.capturedAt) {
      return [];
    }

    const timestamp = Date.parse(observation.comparable.capturedAt);
    return Number.isFinite(timestamp) ? [{ id: observation.comparable.id, timestamp }] : [];
  });

  if (datedObservations.length === 0) {
    return {
      status: "warn",
      message: "A amostra não possui datas de coleta suficientes para validar o limite de 24 meses.",
      value: "sem datas"
    };
  }

  const stale = datedObservations.filter((item) => monthDifference(item.timestamp, now) > 24);

  return {
    staleIds: stale.map(item => item.id),
    status: stale.length === 0 ? "pass" : "fail",
    message:
      stale.length === 0
        ? "Nenhum dado datado há mais de 24 meses."
        : `${stale.length} dado(s) coletado(s) há mais de 24 meses: ${stale
            .slice(0, 3)
            .map((item) => item.id)
            .join(", ")}.`,
    value: `${stale.length}/${datedObservations.length}`
  };
}

function monthDifference(earlierTimestamp: number, laterTimestamp: number): number {
  const earlier = new Date(earlierTimestamp);
  const later = new Date(laterTimestamp);
  return (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 + later.getUTCMonth() - earlier.getUTCMonth();
}

function essentialVariableCoverage(fit: FittedModel): { present: string[]; missing: string[] } {
  const fields = new Set<string>();

  for (const term of fit.terms) {
    fields.add(`${term.sourceField} ${term.label}`.toLowerCase());
  }

  for (const observation of fit.observations) {
    for (const key of Object.keys(observation.comparable.values)) {
      fields.add(key.toLowerCase());
    }
  }

  const joined = Array.from(fields).join(" ");
  const groups = [
    { label: "área", pattern: /area|privativa|terreno/ },
    { label: "localização", pattern: /local|bairro|zona|regiao|região|dist|cidade|endereco|endereço/ },
    { label: "padrão", pattern: /padrao|padrão|qualidade|acabamento|classe/ },
    { label: "conservação", pattern: /conserv|idade|estado|depreci|ano/ },
    { label: "vagas", pattern: /vaga|garagem|parking/ },
    { label: "data", pattern: /data|date|captur|coleta|oferta|mes|mês|ano/ }
  ];
  const present = groups.filter((group) => group.pattern.test(joined)).map((group) => group.label);
  const missing = groups.filter((group) => !group.pattern.test(joined)).map((group) => group.label);

  return { present, missing };
}

function micronumerositySummary(fit: FittedModel): { checkedGroups: number; threshold: string; violations: string[] } {
  const categoricalSources = Array.from(new Set(fit.terms.filter((term) => term.category !== undefined).map((term) => term.sourceField)));
  const threshold = micronumerosityMinimum(fit.n);
  const violations: string[] = [];
  let checkedGroups = 0;

  for (const sourceField of categoricalSources) {
    const counts = new Map<string, number>();

    for (const observation of fit.observations) {
      const value = observation.comparable.values[sourceField];

      if (value === null || value === undefined || value === "") {
        continue;
      }

      const key = normalizedValueKey(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    for (const [category, count] of counts) {
      checkedGroups += 1;

      if (count < threshold) {
        violations.push(`${sourceField}=${category}: ${count} < ${threshold}`);
      }
    }
  }

  return {
    checkedGroups,
    threshold: `n_i >= ${threshold}`,
    violations
  };
}

function micronumerosityMinimum(n: number): number {
  if (n <= 30) {
    return 3;
  }

  if (n <= 100) {
    return Math.max(3, Math.ceil(n * 0.1));
  }

  return 10;
}

function residualNormalitySummary(fit: FittedModel): { passed: boolean; value: string; message: string; bands: Array<{ label: string; percent: number; min: number; max: number }> } {
  const bands = [
    { label: "68%", limit: 1, min: 64, max: 75 },
    { label: "90%", limit: 1.645, min: 89, max: 95 },
    { label: "95%", limit: 1.96, min: 95, max: 100 }
  ];
  const values = bands.map((band) => {
    const percent =
      (fit.diagnosticPoints.filter((point) => Math.abs(point.studentizedResidual) <= band.limit).length / Math.max(fit.n, 1)) * 100;
    return {
      ...band,
      percent
    };
  });
  const failed = values.filter((item) => item.percent < item.min || item.percent > item.max);

  return {
    bands: values,
    passed: failed.length === 0,
    value: values.map((item) => `${item.label}: ${formatPercent(item.percent)}`).join("; "),
    message:
      failed.length === 0
        ? "Distribuição dos resíduos dentro dos intervalos da Tabela 2."
        : `Revisar normalidade: ${failed
            .map((item) => `${item.label}=${formatPercent(item.percent)} fora de ${formatPercent(item.min)}-${formatPercent(item.max)}`)
            .join("; ")}.`
  };
}

function studentTDominanceSummary(fit: FittedModel): { dominant: boolean; value: string; message: string; dominantLabel?: string } {
  const tValues = fit.termCoefficients
    .filter((coefficient) => coefficient.term !== "intercept")
    .map((coefficient) => ({ label: coefficient.label, value: Math.abs(coefficient.tStatistic) }));

  if (tValues.length <= 1) {
    return {
      dominant: false,
      value: "n/a",
      message: "Não há variáveis suficientes para teste de dominância de T de Student."
    };
  }

  tValues.sort((left, right) => right.value - left.value);
  const max = tValues[0];
  const othersSum = tValues.slice(1).reduce((sum, item) => sum + item.value, 0);
  const dominant = Boolean(max && max.value > 5 * othersSum);

  return {
    dominant,
    ...(dominant && max ? { dominantLabel: max.label } : {}),
    value: max ? `${max.label}: ${round(max.value, 3)} / demais ${round(othersSum, 3)}` : "n/a",
    message:
      dominant && max
        ? `${max.label} tem T de Student superior a 5 vezes a soma dos demais.`
        : "Nenhum T de Student supera 5 vezes a soma dos demais."
  };
}

function heteroscedasticitySummary(fit: FittedModel): { r2: number; message: string } {
  const fitted = fit.observations.map((observation) => observation.fitted);
  const absoluteResiduals = fit.observations.map((observation) => Math.abs(observation.residual));
  const r = pearsonCorrelation(fitted, absoluteResiduals);
  const r2 = r * r;

  return {
    r2,
    message:
      r2 <= defaultDraftThresholds.maxHeteroscedasticityR2
        ? "Sem tendência linear forte entre valores ajustados e resíduos absolutos."
        : "Há tendência nos resíduos absolutos; revisar possível heterocedasticidade no gráfico."
  };
}

function maxOriginalRelativeResidualSummary(fit: FittedModel): { percent: number; classification: string } {
  const percent = Math.max(
    0,
    ...fit.observations.map((observation) =>
      Math.abs((observation.originalTargetValue - observation.originalFittedValue) / Math.max(Math.abs(observation.originalFittedValue), EPSILON)) * 100
    )
  );

  return {
    percent,
    classification: relativeResidualClassification(percent)
  };
}

function relativeResidualClassification(percent: number): string {
  if (percent <= 30) {
    return "Ótimo";
  }

  if (percent <= 40) {
    return "Muito bom";
  }

  if (percent <= 50) {
    return "Bom";
  }

  if (percent <= 60) {
    return "Regular";
  }

  if (percent <= 80) {
    return "Aceitável";
  }

  return "Analisar desabilitar o dado";
}

function maxLinearResidualVariationSummary(fit: FittedModel): { percent: number; threshold: number } {
  const percent = Math.max(
    0,
    ...fit.observations.map((observation) => Math.abs(observation.residual / Math.max(Math.abs(observation.fitted), EPSILON)) * 100)
  );

  return {
    percent,
    threshold: residualVariationThreshold(fit.n - fit.p)
  };
}

function residualVariationThreshold(degreesOfFreedom: number): number {
  const table = [
    { df: 5, percent: 45 },
    { df: 10, percent: 40 },
    { df: 15, percent: 35 },
    { df: 20, percent: 30 },
    { df: 25, percent: 25 },
    { df: 30, percent: 20 },
    { df: 35, percent: 15 },
    { df: 40, percent: 10 },
    { df: 45, percent: 8 },
    { df: 50, percent: 5 }
  ];

  if (degreesOfFreedom <= (table[0]?.df ?? 5)) {
    return table[0]?.percent ?? 45;
  }

  for (let index = 1; index < table.length; index += 1) {
    const lower = table[index - 1];
    const upper = table[index];

    if (lower && upper && degreesOfFreedom <= upper.df) {
      const ratio = (degreesOfFreedom - lower.df) / (upper.df - lower.df);
      return lower.percent + ratio * (upper.percent - lower.percent);
    }
  }

  return table[table.length - 1]?.percent ?? 5;
}

function independentCorrelationSummary(fit: FittedModel): { maxAbs: number; message: string } {
  const featureColumns = transpose(fit.x).slice(1);
  let maxAbs = 0;
  let pair = "";

  for (let leftIndex = 0; leftIndex < featureColumns.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < featureColumns.length; rightIndex += 1) {
      const correlation = Math.abs(pearsonCorrelation(featureColumns[leftIndex] ?? [], featureColumns[rightIndex] ?? []));

      if (correlation > maxAbs) {
        maxAbs = correlation;
        pair = `${fit.terms[leftIndex]?.label ?? `x${leftIndex + 1}`} x ${fit.terms[rightIndex]?.label ?? `x${rightIndex + 1}`}`;
      }
    }
  }

  return {
    maxAbs,
    message: maxAbs > defaultDraftThresholds.maxStrongCorrelation ? `Correlação forte entre independentes: ${pair}.` : "Sem correlação forte entre independentes."
  };
}

function dependentCorrelationSummary(fit: FittedModel): { maxAbs: number; message: string } {
  const featureColumns = transpose(fit.x).slice(1);
  let maxAbs = 0;
  let label = "";

  for (let index = 0; index < featureColumns.length; index += 1) {
    const correlation = Math.abs(pearsonCorrelation(featureColumns[index] ?? [], fit.y));

    if (correlation > maxAbs) {
      maxAbs = correlation;
      label = fit.terms[index]?.label ?? `x${index + 1}`;
    }
  }

  return {
    maxAbs,
    message:
      maxAbs > defaultDraftThresholds.maxStrongCorrelation
        ? `Correlação forte entre ${label} e a dependente; revisar dominância e justificativa.`
        : "Sem correlação forte acima de 80% entre independente e dependente."
  };
}

function projectionInflexionRiskSummary(fit: FittedModel): { risky: boolean; terms: string[]; message: string } {
  const riskyTerms = fit.terms
    .filter((term) => term.transform === "square" || term.transform === "inverse")
    .map((term) => term.label);
  const targetRisk = fit.target.transform === "square" || fit.target.transform === "inverse" ? [`alvo ${fit.target.transform}`] : [];
  const terms = [...riskyTerms, ...targetRisk];

  return {
    risky: terms.length > 0,
    terms,
    message:
      terms.length === 0
        ? "Sem indício automático de inflexão por transformação quadrática/inversa."
        : `Revisar gráfico de máximos por transformação potencialmente não monotônica: ${terms.join(", ")}.`
  };
}

function projectionIntervalAmplitudeSummary(valuation: ValuationInterval | undefined): {
  status: RulePackCheck["status"];
  message: string;
  value: string;
} {
  if (!valuation || valuation.estimate === 0) {
    return {
      status: "warn",
      message: "Sem estimativa do avaliando para validar a amplitude do intervalo.",
      value: "n/a"
    };
  }

  const percent = Math.abs((valuation.upper - valuation.lower) / valuation.estimate) * 100;

  return {
    status: percent <= defaultDraftThresholds.maxProjectionIntervalAmplitudePercent ? "pass" : "fail",
    message:
      percent <= defaultDraftThresholds.maxProjectionIntervalAmplitudePercent
        ? "Amplitude total do intervalo de confiança abaixo de 50%."
        : "Amplitude total do intervalo de confiança acima de 50%.",
    value: formatPercent(percent)
  };
}

function projectionExtrapolationSummary(
  fit: FittedModel,
  subjectValues: SubjectProperty["values"] | undefined
): { status: RulePackCheck["status"]; message: string; outside: string[] } {
  if (!subjectValues) {
    return {
      status: "warn",
      message: "Sem valores do avaliando para validar extrapolação.",
      outside: []
    };
  }

  const outside: string[] = [];

  for (let termIndex = 0; termIndex < fit.terms.length; termIndex += 1) {
    const term = fit.terms[termIndex];

    if (!term) {
      continue;
    }

    const subjectValue = termValue(subjectValues, term);

    if (subjectValue === null) {
      outside.push(`${term.label}: valor ausente`);
      continue;
    }

    const column = fit.x.map((row) => row[termIndex + 1] ?? 0);
    const min = Math.min(...column);
    const max = Math.max(...column);

    if (subjectValue < min - EPSILON || subjectValue > max + EPSILON) {
      outside.push(`${term.label}: ${round(subjectValue, 4)} fora de [${round(min, 4)}, ${round(max, 4)}]`);
    }
  }

  return {
    status: "pass",
    message: "Valores do avaliando dentro dos intervalos observados para os termos do modelo.",
    outside
  };
}

function predictSubjectValue(fit: FittedModel, subjectValues: SubjectProperty["values"]): ValuationInterval | undefined {
  const termValues = fit.terms.map((term) => termValue(subjectValues, term));

  if (termValues.some((value) => value === null)) {
    return undefined;
  }

  const x0 = [1, ...(termValues as number[])];
  const estimateOnScale = dot(x0, fit.coefficients);
  const leverage = dot(x0, multiplyMatrixVector(fit.xtxInverse, x0));
  const standardErrorPrediction = Math.sqrt(Math.max((1 + leverage) * fit.sigma2, EPSILON));
  const critical = inverseStudentT(0.975, fit.n - fit.p);
  const lowerOnScale = estimateOnScale - critical * standardErrorPrediction;
  const upperOnScale = estimateOnScale + critical * standardErrorPrediction;
  const lowerOriginalScale = inverseTransform(lowerOnScale, fit.target.transform);
  const upperOriginalScale = inverseTransform(upperOnScale, fit.target.transform);

  return {
    estimate: inverseTransform(estimateOnScale, fit.target.transform),
    lower: Math.min(lowerOriginalScale, upperOriginalScale),
    upper: Math.max(lowerOriginalScale, upperOriginalScale),
    confidenceLevel: 0.95
  };
}

function scoreCandidate(fit: FittedModel, accepted: boolean, valuation: ValuationInterval | undefined, ruleChecks: RulePackCheck[]): { total: number, breakdown: ScoreBreakdown } {
  const failedChecks = ruleChecks.filter((check) => check.status === "fail").length;
  const warnings = ruleChecks.filter((check) => check.status === "warn").length;
  const intervalPenalty =
    valuation && valuation.estimate !== 0 ? Math.abs((valuation.upper - valuation.lower) / valuation.estimate) * 8 : 0;
  const complexityPenalty = fit.terms.length * 1.8;
  const vifPenalty = Math.max(0, fit.diagnostics.maxVif - 1) * 0.8;
  const informationPenalty = Math.max(0, fit.diagnostics.aic) * 0.01;
  const base = fit.diagnostics.adjustedR2 * 100 - fit.diagnostics.rmse * 0.0001;

  const acceptanceBonus = accepted ? 1000 : -1000;
  const warningsPenalty = warnings * 6;
  const failedChecksPenalty = failedChecks * 30;
  const total = round(acceptanceBonus + base - intervalPenalty - complexityPenalty - vifPenalty - informationPenalty - warningsPenalty - failedChecksPenalty, 4);

  return {
    total,
    breakdown: {
      base: round(base, 4),
      acceptanceBonus,
      intervalPenalty: round(intervalPenalty, 4),
      complexityPenalty: round(complexityPenalty, 4),
      vifPenalty: round(vifPenalty, 4),
      informationPenalty: round(informationPenalty, 4),
      warningsPenalty: round(warningsPenalty, 4),
      failedChecksPenalty: round(failedChecksPenalty, 4),
      total
    }
  };
}

function buildTargetCandidates(input: {
  comparables: MarketComparable[];
  target: VariableDefinition;
  featureVariables: VariableDefinition[];
  autoTargetTransformSearch: boolean;
  maxTargetTransformCandidates: number;
}): VariableDefinition[] {
  if (!input.autoTargetTransformSearch || input.target.kind !== "numeric") {
    return [input.target];
  }

  const scoredTransforms = TARGET_TRANSFORMS.map((transform) => ({
    transform,
    score: targetTransformationScore(input.comparables, input.target, input.featureVariables, transform)
  })).filter((item) => item.score.validCount >= Math.max(6, Math.min(input.comparables.length, 10)));

  if (scoredTransforms.length === 0) {
    return [input.target];
  }

  scoredTransforms.sort((left, right) => {
    if (right.score.score !== left.score.score) {
      return right.score.score - left.score.score;
    }

    return TARGET_TRANSFORMS.indexOf(left.transform) - TARGET_TRANSFORMS.indexOf(right.transform);
  });

  const noneScore = scoredTransforms.find((item) => item.transform === "none")?.score.score ?? -Infinity;
  const bestScore = scoredTransforms[0]?.score.score ?? noneScore;
  const transforms = new Set<TransformKind>();

  if (input.target.transform !== "none") {
    transforms.add(input.target.transform);
  }

  transforms.add("none");

  for (const item of scoredTransforms) {
    const materiallyBetterThanNone = item.score.score >= noneScore + 0.02;
    const closeToBest = item.score.score >= bestScore - 0.03;

    if (item.transform === "none" || materiallyBetterThanNone || closeToBest) {
      transforms.add(item.transform);
    }

    if (transforms.size >= Math.max(1, input.maxTargetTransformCandidates)) {
      break;
    }
  }

  return Array.from(transforms)
    .map((transform) => ({
      ...input.target,
      transform,
      notes: targetTransformLinearityNote(input.target, transform, scoredTransforms)
    }))
    .sort((left, right) => targetTransformSortScore(right, scoredTransforms) - targetTransformSortScore(left, scoredTransforms));
}

function targetTransformationScore(
  comparables: MarketComparable[],
  target: VariableDefinition,
  featureVariables: VariableDefinition[],
  transform: TransformKind
): { score: number; r2: number; validCount: number } {
  const targetCandidate = { ...target, transform };
  const featureScores = featureVariables.flatMap((variable) => {
    if (variable.kind === "numeric") {
      return FEATURE_TRANSFORMS.map((featureTransform) =>
        transformationLinearityScore(comparables, targetCandidate, variable, featureTransform)
      );
    }

    return [categoricalTargetAssociationScore(comparables, targetCandidate, variable)];
  });
  const validScores = featureScores
    .filter((score) => score.validCount >= Math.max(6, Math.min(comparables.length, 10)))
    .sort((left, right) => right.score - left.score);

  if (validScores.length === 0) {
    return { score: -Infinity, r2: 0, validCount: 0 };
  }

  const topScores = validScores.slice(0, Math.min(3, validScores.length));
  const averageTopScore = average(topScores.map((score) => score.score));
  const best = validScores[0] ?? { r2: 0, validCount: 0 };
  const complexityPenalty = transform === "none" ? 0 : 0.015;

  return {
    score: averageTopScore - complexityPenalty,
    r2: best.r2,
    validCount: best.validCount
  };
}

function categoricalTargetAssociationScore(
  comparables: MarketComparable[],
  target: VariableDefinition,
  variable: VariableDefinition
): { score: number; r2: number; validCount: number } {
  const pairs = comparables.flatMap((comparable) => {
    const categoryValue = comparable.values[variable.sourceField];
    const y = transformedNumber(comparable.values[target.sourceField], target.transform);

    if (categoryValue === null || categoryValue === undefined || categoryValue === "" || y === null) {
      return [];
    }

    return [{ category: normalizedValueKey(categoryValue), y }];
  });

  if (pairs.length < 3) {
    return { score: -Infinity, r2: 0, validCount: pairs.length };
  }

  const yMean = average(pairs.map((pair) => pair.y));
  const totalSst = pairs.reduce((sum, pair) => sum + (pair.y - yMean) ** 2, 0);
  const groups = new Map<string, number[]>();

  for (const pair of pairs) {
    groups.set(pair.category, [...(groups.get(pair.category) ?? []), pair.y]);
  }

  const withinSse = Array.from(groups.values()).reduce((sum, values) => {
    const groupMean = average(values);
    return sum + values.reduce((groupSum, value) => groupSum + (value - groupMean) ** 2, 0);
  }, 0);
  const r2 = totalSst <= EPSILON ? 0 : 1 - withinSse / totalSst;
  const validRatio = pairs.length / Math.max(comparables.length, 1);

  return {
    score: r2 * validRatio - (1 - validRatio) * 0.15,
    r2,
    validCount: pairs.length
  };
}

function targetTransformLinearityNote(
  target: VariableDefinition,
  transform: TransformKind,
  scoredTransforms: Array<{ transform: TransformKind; score: { r2: number; validCount: number } }>
): string {
  const score = scoredTransforms.find((item) => item.transform === transform)?.score;
  const base = target.notes ? `${target.notes} ` : "";

  if (!score) {
    return `${base}Transformação alvo ${transform} mantida como opção manual.`;
  }

  return `${base}Transformação alvo ${transform} selecionada por triagem univariada: R²=${round(score.r2, 3)}, n=${score.validCount}.`;
}

function targetTransformSortScore(
  target: VariableDefinition,
  scoredTransforms: Array<{ transform: TransformKind; score: { score: number } }>
): number {
  return scoredTransforms.find((item) => item.transform === target.transform)?.score.score ?? -Infinity;
}

function buildVariableCandidateGroups(input: {
  comparables: MarketComparable[];
  target: VariableDefinition;
  featureVariables: VariableDefinition[];
  autoTransformSearch: boolean;
  maxTransformCandidatesPerVariable: number;
}): VariableCandidateGroup[] {
  return input.featureVariables.map((variable) => {
    if (!input.autoTransformSearch || variable.kind !== "numeric") {
      return {
        required: Boolean(variable.required),
        variants: [variable]
      };
    }

    return {
      required: Boolean(variable.required),
      variants: rankedTransformVariants({
        comparables: input.comparables,
        target: input.target,
        variable,
        maxCandidates: input.maxTransformCandidatesPerVariable
      })
    };
  });
}

function rankedTransformVariants(input: {
  comparables: MarketComparable[];
  target: VariableDefinition;
  variable: VariableDefinition;
  maxCandidates: number;
}): VariableDefinition[] {
  const scoredTransforms = FEATURE_TRANSFORMS.map((transform) => ({
    transform,
    score: transformationLinearityScore(input.comparables, input.target, input.variable, transform)
  })).filter((item) => item.score.validCount >= Math.max(6, Math.min(input.comparables.length, 10)));

  if (scoredTransforms.length === 0) {
    return [input.variable];
  }

  scoredTransforms.sort((left, right) => {
    if (right.score.score !== left.score.score) {
      return right.score.score - left.score.score;
    }

    return FEATURE_TRANSFORMS.indexOf(left.transform) - FEATURE_TRANSFORMS.indexOf(right.transform);
  });

  const noneScore = scoredTransforms.find((item) => item.transform === "none")?.score.score ?? -Infinity;
  const bestScore = scoredTransforms[0]?.score.score ?? noneScore;
  const transforms = new Set<TransformKind>();

  if (input.variable.transform !== "none") {
    transforms.add(input.variable.transform);
  }

  transforms.add("none");

  for (const item of scoredTransforms) {
    const materiallyBetterThanNone = item.score.score >= noneScore + 0.02;
    const closeToBest = item.score.score >= bestScore - 0.03;

    if (item.transform === "none" || materiallyBetterThanNone || closeToBest) {
      transforms.add(item.transform);
    }

    if (transforms.size >= Math.max(1, input.maxCandidates)) {
      break;
    }
  }

  return Array.from(transforms)
    .map((transform) => ({
      ...input.variable,
      transform,
      notes: transformLinearityNote(input.variable, transform, scoredTransforms)
    }))
    .sort((left, right) => transformSortScore(right, scoredTransforms) - transformSortScore(left, scoredTransforms));
}

function transformationLinearityScore(
  comparables: MarketComparable[],
  target: VariableDefinition,
  variable: VariableDefinition,
  transform: TransformKind
): { score: number; r2: number; validCount: number } {
  const pairs = comparables.flatMap((comparable) => {
    const x = transformedNumber(comparable.values[variable.sourceField], transform);
    const y = transformedNumber(comparable.values[target.sourceField], target.transform);

    if (x === null || y === null) {
      return [];
    }

    return [{ x, y }];
  });

  if (pairs.length < 3) {
    return { score: -Infinity, r2: 0, validCount: pairs.length };
  }

  const xs = pairs.map((pair) => pair.x);
  const ys = pairs.map((pair) => pair.y);
  const r = pearsonCorrelation(xs, ys);
  const r2 = r * r;
  const validRatio = pairs.length / Math.max(comparables.length, 1);
  const missingPenalty = (1 - validRatio) * 0.15;
  const complexityPenalty = transform === "none" ? 0 : 0.01;

  return {
    score: r2 * validRatio - missingPenalty - complexityPenalty,
    r2,
    validCount: pairs.length
  };
}

function transformLinearityNote(
  variable: VariableDefinition,
  transform: TransformKind,
  scoredTransforms: Array<{ transform: TransformKind; score: { r2: number; validCount: number } }>
): string {
  const score = scoredTransforms.find((item) => item.transform === transform)?.score;
  const base = variable.notes ? `${variable.notes} ` : "";

  if (!score) {
    return `${base}Transformação ${transform} mantida como opção manual.`;
  }

  return `${base}Transformação ${transform} selecionada por triagem univariada: R²=${round(score.r2, 3)}, n=${score.validCount}.`;
}

function transformSortScore(variable: VariableDefinition, scoredTransforms: Array<{ transform: TransformKind; score: { score: number } }>): number {
  return scoredTransforms.find((item) => item.transform === variable.transform)?.score.score ?? -Infinity;
}

function createTerms(comparables: MarketComparable[], variables: VariableDefinition[]): DesignTerm[] {
  return variables.flatMap((variable) => {
    const expectedSign = variable.expectedSign ?? "none";

    if (variable.kind === "categorical") {
      const categories = Array.from(
        new Set(
          comparables
            .map((comparable) => comparable.values[variable.sourceField])
            .filter((value): value is string | number | boolean => value !== null && value !== undefined && value !== "")
            .map(String)
        )
      ).sort((left, right) => left.localeCompare(right));

      return categories.slice(1).map((category) => ({
        key: `${variable.id}=${category}`,
        label: `${variable.label}: ${category}`,
        variableId: variable.id,
        sourceField: variable.sourceField,
        transform: "none" as TransformKind,
        expectedSign,
        category
      }));
    }

    if (variable.kind === "binary") {
      const category = binaryPositiveCategory(comparables, variable.sourceField);

      if (category !== null) {
        return [
          {
            key: `${variable.id}=${category}`,
            label: `${variable.label}: ${category}`,
            variableId: variable.id,
            sourceField: variable.sourceField,
            transform: "none" as TransformKind,
            expectedSign,
            category
          }
        ];
      }
    }

    return [
      {
        key: `${variable.id}:${variable.transform}`,
        label: variable.transform === "none" ? variable.label : `${variable.transform}(${variable.label})`,
        variableId: variable.id,
        sourceField: variable.sourceField,
        transform: variable.transform,
        expectedSign: adjustedExpectedSignForTransform(expectedSign, variable.transform)
      }
    ];
  });
}

function resolveTargetVariable(variables: VariableDefinition[], targetVariableId: string | undefined): VariableDefinition {
  const target = targetVariableId
    ? variables.find((variable) => variable.id === targetVariableId)
    : variables.find((variable) => variable.role === "target");

  if (!target) {
    throw new Error("Defina uma variável alvo para o valor do imóvel.");
  }

  return target;
}

function variableCombinations(
  groups: VariableCandidateGroup[],
  minVariables: number,
  maxVariables: number,
  maxCombinations: number
): VariableDefinition[][] {
  const required = groups.filter((group) => group.required);
  const optional = groups.filter((group) => !group.required);
  const combinations: VariableDefinition[][] = [];

  for (let size = Math.max(required.length, minVariables); size <= Math.max(required.length, maxVariables); size += 1) {
    const optionalSize = size - required.length;
    choose(optional, optionalSize, (selected) => {
      appendVariantProducts([...required, ...selected], combinations, maxCombinations);
    });

    if (combinations.length >= maxCombinations) {
      break;
    }
  }

  if (combinations.length === 0 && required.length > 0) {
    appendVariantProducts(required, combinations, maxCombinations);
  }

  return combinations;
}

function appendVariantProducts(
  groups: VariableCandidateGroup[],
  combinations: VariableDefinition[][],
  maxCombinations: number,
  index = 0,
  selected: VariableDefinition[] = []
): void {
  if (combinations.length >= maxCombinations) {
    return;
  }

  if (index >= groups.length) {
    combinations.push([...selected]);
    return;
  }

  const group = groups[index];

  if (!group) {
    return;
  }

  for (const variant of group.variants) {
    selected.push(variant);
    appendVariantProducts(groups, combinations, maxCombinations, index + 1, selected);
    selected.pop();

    if (combinations.length >= maxCombinations) {
      break;
    }
  }
}

function choose<T>(items: T[], size: number, visitor: (selected: T[]) => void, start = 0, selected: T[] = []): void {
  if (selected.length === size) {
    visitor([...selected]);
    return;
  }

  for (let index = start; index <= items.length - (size - selected.length); index += 1) {
    const item = items[index];

    if (item === undefined) {
      continue;
    }

    selected.push(item);
    choose(items, size, visitor, index + 1, selected);
    selected.pop();
  }
}

function termValue(values: Record<string, DataValue>, term: DesignTerm): number | null {
  const value = values[term.sourceField];

  if (term.category !== undefined) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return normalizedValueKey(value) === normalizedValueKey(term.category) ? 1 : 0;
  }

  return transformedNumber(value, term.transform);
}

function binaryPositiveCategory(comparables: MarketComparable[], sourceField: string): string | null {
  const categories = Array.from(
    new Set(
      comparables
        .map((comparable) => comparable.values[sourceField])
        .filter((value): value is string | number | boolean => value !== null && value !== undefined && value !== "")
        .map(normalizedValueKey)
    )
  ).sort((left, right) => left.localeCompare(right));

  return categories.length === 2 ? categories[1] ?? null : null;
}

function adjustedExpectedSignForTransform(expectedSign: ExpectedSign, transform: TransformKind): ExpectedSign {
  if (transform !== "inverse") {
    return expectedSign;
  }

  if (expectedSign === "positive") {
    return "negative";
  }

  if (expectedSign === "negative") {
    return "positive";
  }

  return expectedSign;
}

function adjustedExpectedSignForTargetTransform(expectedSign: ExpectedSign, transform: TransformKind): ExpectedSign {
  if (transform !== "inverse") {
    return expectedSign;
  }

  if (expectedSign === "positive") {
    return "negative";
  }

  if (expectedSign === "negative") {
    return "positive";
  }

  return expectedSign;
}

export function transformedNumber(value: DataValue | undefined, transform: TransformKind): number | null {
  const numberValue = coerceNumber(value);

  if (numberValue === null || !Number.isFinite(numberValue)) {
    return null;
  }

  switch (transform) {
    case "none":
      return numberValue;
    case "log":
      return numberValue > 0 ? Math.log(numberValue) : null;
    case "sqrt":
      return numberValue >= 0 ? Math.sqrt(numberValue) : null;
    case "square":
      return numberValue * numberValue;
    case "inverse":
      return Math.abs(numberValue) > EPSILON ? 1 / numberValue : null;
  }
}

export function coerceNumber(value: DataValue | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  const decimalComma = /,\d{1,6}$/.test(normalized);
  const numeric = decimalComma ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  const parsed = Number(numeric);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedValueKey(value: DataValue): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const numberValue = coerceNumber(value);

  if (numberValue !== null) {
    return String(numberValue);
  }

  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isBooleanLike(value: DataValue): boolean {
  if (typeof value === "boolean") {
    return true;
  }

  const key = normalizedValueKey(value);
  return ["0", "1", "true", "false", "sim", "nao", "não", "yes", "no"].includes(key);
}

function inverseTransform(value: number, transform: TransformKind): number {
  switch (transform) {
    case "none":
      return value;
    case "log":
      return Math.exp(value);
    case "sqrt":
      return value * value;
    case "square":
      return Math.sqrt(Math.max(value, 0));
    case "inverse":
      return Math.abs(value) > EPSILON ? 1 / value : Number.NaN;
  }
}

function calculateVif(x: number[][]): number[] {
  if (x.length === 0 || (x[0]?.length ?? 0) <= 2) {
    return [1];
  }

  const featureCount = (x[0]?.length ?? 1) - 1;
  const vifs: number[] = [];

  for (let featureIndex = 1; featureIndex <= featureCount; featureIndex += 1) {
    const y = x.map((row) => row[featureIndex] ?? 0);
    const predictors = x.map((row) => [1, ...row.slice(1).filter((_, index) => index + 1 !== featureIndex)]);

    try {
      const xt = transpose(predictors);
      const beta = multiplyMatrixVector(inverse(multiplyMatrices(xt, predictors)), multiplyMatrixVector(xt, y));
      const fitted = predictors.map((row) => dot(row, beta));
      const mean = average(y);
      const sse = y.reduce((sum, value, index) => sum + (value - (fitted[index] ?? 0)) ** 2, 0);
      const sst = y.reduce((sum, value) => sum + (value - mean) ** 2, 0);
      const r2 = sst <= EPSILON ? 0 : 1 - sse / sst;
      vifs.push(1 / Math.max(1 - r2, EPSILON));
    } catch {
      vifs.push(Number.POSITIVE_INFINITY);
    }
  }

  return vifs;
}

function formatEquation(target: VariableDefinition, fit: FittedModel): string {
  const linearPredictor = formatLinearPredictor(fit);

  if (target.transform === "none") {
    return `${target.label} = ${linearPredictor}`;
  }

  return `${target.label} = ${inverseTransformExpression(target.transform, linearPredictor)}`;
}

function formatLinearPredictor(fit: FittedModel): string {
  const parts = fit.coefficients.map((coefficient, index) => {
    if (index === 0) {
      return formatNumber(coefficient);
    }

    const term = fit.terms[index - 1];
    const sign = coefficient >= 0 ? "+" : "-";
    return `${sign} ${formatNumber(Math.abs(coefficient))} * ${term?.label ?? `x${index}`}`;
  });

  return parts.join(" ");
}

function inverseTransformExpression(transform: TransformKind, expression: string): string {
  switch (transform) {
    case "none":
      return expression;
    case "log":
      return `exp(${expression})`;
    case "sqrt":
      return `(${expression})^2`;
    case "square":
      return `sqrt(${expression})`;
    case "inverse":
      return `1 / (${expression})`;
  }
}

function formatTermList(target: VariableDefinition, terms: DesignTerm[]): string {
  const predictor = terms.map((term) => term.label).join(" + ") || "intercepto";

  if (target.transform === "none") {
    return `${target.label} ~ ${predictor}`;
  }

  return `${target.label} ~ ${inverseTransformExpression(target.transform, predictor)}`;
}

function makeCheck(input: {
  id: string;
  label: string;
  status: RulePackCheck["status"];
  message: string;
  value?: number | string;
  threshold?: number | string;
}): RulePackCheck {
  const check: RulePackCheck = {
    id: input.id,
    label: input.label,
    status: input.status,
    message: input.message
  };

  if (input.value !== undefined) {
    check.value = input.value;
  }

  if (input.threshold !== undefined) {
    check.threshold = input.threshold;
  }

  return check;
}

function emptyDiagnostics(): DiagnosticSummary {
  return {
    r2: 0,
    adjustedR2: 0,
    rmse: 0,
    aic: 0,
    bic: 0,
    fStatistic: 0,
    fPValue: 1,
    maxVif: 0,
    maxCookDistance: 0,
    maxAbsStudentizedResidual: 0
  };
}

function transpose(matrix: number[][]): number[][] {
  const rowCount = matrix.length;
  const columnCount = matrix[0]?.length ?? 0;
  const result: number[][] = Array.from({ length: columnCount }, () => Array(rowCount).fill(0));

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      result[column]![row] = matrix[row]?.[column] ?? 0;
    }
  }

  return result;
}

function multiplyMatrices(left: number[][], right: number[][]): number[][] {
  const rows = left.length;
  const columns = right[0]?.length ?? 0;
  const shared = right.length;
  const result: number[][] = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let sum = 0;

      for (let index = 0; index < shared; index += 1) {
        sum += (left[row]?.[index] ?? 0) * (right[index]?.[column] ?? 0);
      }

      result[row]![column] = sum;
    }
  }

  return result;
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => dot(row, vector));
}

function inverse(matrix: number[][]): number[][] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, identityIndex) => (identityIndex === index ? 1 : 0))
  ]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let bestRow = pivotIndex;
    let bestValue = Math.abs(augmented[pivotIndex]?.[pivotIndex] ?? 0);

    for (let row = pivotIndex + 1; row < size; row += 1) {
      const value = Math.abs(augmented[row]?.[pivotIndex] ?? 0);

      if (value > bestValue) {
        bestRow = row;
        bestValue = value;
      }
    }

    if (bestValue < EPSILON) {
      throw new Error("Matriz singular: há variáveis colineares ou dados insuficientes.");
    }

    if (bestRow !== pivotIndex) {
      const current = augmented[pivotIndex];
      const best = augmented[bestRow];

      if (current && best) {
        augmented[pivotIndex] = best;
        augmented[bestRow] = current;
      }
    }

    const pivot = augmented[pivotIndex]?.[pivotIndex] ?? 1;

    for (let column = 0; column < size * 2; column += 1) {
      augmented[pivotIndex]![column] = (augmented[pivotIndex]?.[column] ?? 0) / pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivotIndex) {
        continue;
      }

      const factor = augmented[row]?.[pivotIndex] ?? 0;

      for (let column = 0; column < size * 2; column += 1) {
        augmented[row]![column] = (augmented[row]?.[column] ?? 0) - factor * (augmented[pivotIndex]?.[column] ?? 0);
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function pearsonCorrelation(left: number[], right: number[]): number {
  const leftMean = average(left);
  const rightMean = average(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean;
    const rightDelta = (right[index] ?? 0) - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);

  if (denominator <= EPSILON) {
    return 0;
  }

  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toFixed(2);
  }

  if (Math.abs(value) >= 10) {
    return value.toFixed(3);
  }

  return value.toFixed(5);
}

function formatPercent(value: number): string {
  return `${round(value, 2).toFixed(2)}%`;
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function twoSidedStudentTPValue(tStatistic: number, degreesOfFreedom: number): number {
  const cdf = studentTCdf(Math.abs(tStatistic), degreesOfFreedom);
  return clamp(2 * (1 - cdf), 0, 1);
}

function inverseStudentT(probability: number, degreesOfFreedom: number): number {
  let low = -20;
  let high = 20;

  for (let index = 0; index < 80; index += 1) {
    const middle = (low + high) / 2;

    if (studentTCdf(middle, degreesOfFreedom) < probability) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function studentTCdf(t: number, degreesOfFreedom: number): number {
  const df = Math.max(degreesOfFreedom, 1);
  const x = df / (df + t * t);
  const beta = regularizedIncompleteBeta(x, df / 2, 0.5);

  return t >= 0 ? 1 - 0.5 * beta : 0.5 * beta;
}

function fDistributionSurvival(fStatistic: number, df1: number, df2: number): number {
  if (!Number.isFinite(fStatistic) || fStatistic < 0) {
    return 1;
  }

  const x = (df1 * fStatistic) / (df1 * fStatistic + df2);
  return clamp(1 - regularizedIncompleteBeta(x, df1 / 2, df2 / 2), 0, 1);
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }

  if (x >= 1) {
    return 1;
  }

  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(x, a, b)) / a;
  }

  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const fpMin = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;

  if (Math.abs(d) < fpMin) {
    d = fpMin;
  }

  d = 1 / d;
  let h = d;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;

    if (Math.abs(d) < fpMin) {
      d = fpMin;
    }

    c = 1 + aa / c;

    if (Math.abs(c) < fpMin) {
      c = fpMin;
    }

    d = 1 / d;
    h *= d * c;
    aa = (-(a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;

    if (Math.abs(d) < fpMin) {
      d = fpMin;
    }

    c = 1 + aa / c;

    if (Math.abs(c) < fpMin) {
      c = fpMin;
    }

    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < 3e-7) {
      break;
    }
  }

  return h;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7
  ];

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let x = 0.9999999999998099;
  const z = value - 1;

  for (let index = 0; index < coefficients.length; index += 1) {
    x += (coefficients[index] ?? 0) / (z + index + 1);
  }

  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function calculateCorrelationMatrix(x: number[][], terms: DesignTerm[]): { labels: string[]; matrix: number[][] } {
  const featureColumns = transpose(x).slice(1);
  const labels = terms.map(t => t.label);
  const matrix: number[][] = [];

  for (let i = 0; i < featureColumns.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < featureColumns.length; j++) {
      if (i === j) {
        row.push(1);
      } else {
        const corr = pearsonCorrelation(featureColumns[i] || [], featureColumns[j] || []);
        row.push(corr);
      }
    }
    matrix.push(row);
  }
  return { labels, matrix };
}
