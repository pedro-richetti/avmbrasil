export type EntityId = string;

export type DataValue = string | number | boolean | null;

export type VariableKind = "numeric" | "categorical" | "binary";

export type VariableRole = "target" | "feature" | "excluded";

export type TransformKind = "none" | "log" | "sqrt" | "square" | "inverse";

export type ExpectedSign = "positive" | "negative" | "none";

export interface Organization {
  id: EntityId;
  name: string;
  createdAt: string;
}

export interface UserRole {
  userId: EntityId;
  organizationId: EntityId;
  role: "owner" | "engineer" | "reviewer" | "viewer";
}

export interface Project {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  purpose: string;
  valuationDate: string;
  status: "draft" | "modeling" | "review" | "approved" | "archived";
  createdAt: string;
}

export interface SubjectProperty {
  id: EntityId;
  projectId: EntityId;
  address: string;
  city: string;
  state: string;
  propertyType: string;
  values: Record<string, DataValue>;
}

export interface MarketComparable {
  id: EntityId;
  address?: string;
  source?: string;
  capturedAt?: string;
  evidenceUrl?: string;
  values: Record<string, DataValue>;
}

export interface ComparableImport {
  id: EntityId;
  projectId: EntityId;
  fileName: string;
  storagePath?: string;
  importedAt: string;
  rowCount: number;
  rawColumns: string[];
}

export interface VariableDefinition {
  id: EntityId;
  label: string;
  sourceField: string;
  role: VariableRole;
  kind: VariableKind;
  transform: TransformKind;
  required?: boolean;
  expectedSign?: ExpectedSign;
  notes?: string;
}

export interface DatasetSnapshot {
  id: EntityId;
  projectId: EntityId;
  createdAt: string;
  comparables: MarketComparable[];
  variables: VariableDefinition[];
  sourceImportId?: EntityId;
}

export interface RulePackCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
  value?: number | string;
  threshold?: number | string;
}

export interface RulePack {
  id: string;
  name: string;
  version: string;
  standardReference: string;
  status: "draft" | "confirmed";
  notes: string;
}

export interface DiagnosticSummary {
  r2: number;
  adjustedR2: number;
  rmse: number;
  aic: number;
  bic: number;
  fStatistic: number;
  fPValue: number;
  maxVif: number;
  maxCookDistance: number;
  maxAbsStudentizedResidual: number;
}

export interface DiagnosticPoint {
  index: number;
  fitted: number;
  residual: number;
  studentizedResidual: number;
  cooksDistance: number;
}

export interface TermCoefficient {
  term: string;
  label: string;
  estimate: number;
  standardError: number;
  tStatistic: number;
  pValue: number;
}

export interface ValuationInterval {
  estimate: number;
  lower: number;
  upper: number;
  confidenceLevel: number;
}

export interface ExtraDiagnostics {
  n: number;
  p: number;
  degreesOfFreedom: number;
  duplicateData: string[];
  staleData: string[];
  missingEssentialVariables: string[];
  micronumerosityViolations: string[];
  r2: number;
  fStatistic: number;
  fPValue: number;
  studentizedResidualsBands: Array<{ label: string; percent: number; min: number; max: number }>;
  termTStatistics: Array<{ label: string; value: number }>;
  tStudentDominant: string | null;
  expectedSignViolations: string[];
  heteroscedasticityR2: number;
  maxRelativeResidual: number;
  vifs: Array<{ label: string; value: number }>;
  correlationMatrix: { labels: string[]; matrix: number[][] };
  projectionInflexionTerms: string[];
}

export interface CandidateModel {
  id: EntityId;
  equation: string;
  terms: string[];
  accepted: boolean;
  score: number;
  rejectionReasons: string[];
  ruleChecks: RulePackCheck[];
  coefficients: TermCoefficient[];
  diagnostics: DiagnosticSummary;
  diagnosticPoints: DiagnosticPoint[];
  valuation?: ValuationInterval;
  extraDiagnostics?: ExtraDiagnostics;
}

export interface ModelRun {
  id: EntityId;
  datasetSnapshotId?: EntityId;
  createdAt: string;
  rulePack: RulePack;
  candidates: CandidateModel[];
  selectedCandidateId?: EntityId;
}

export interface ReportSnapshot {
  id: EntityId;
  projectId: EntityId;
  modelRunId: EntityId;
  candidateModelId: EntityId;
  createdAt: string;
  approvedBy: string;
  payload: Record<string, unknown>;
  html: string;
}
