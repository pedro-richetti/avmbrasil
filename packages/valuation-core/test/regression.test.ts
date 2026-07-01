import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarketComparable, VariableDefinition } from "@avm/domain";
import { inferVariableKind, runModelSearch, transformedNumber } from "@avm/valuation-core";

const comparables: MarketComparable[] = Array.from({ length: 18 }, (_, index) => {
  const area = 55 + index * 5;
  const parking = index % 3 === 0 ? 2 : index % 2;
  const age = 2 + (index % 9);
  const noise = [-7000, 2000, 5000, -2000, 3000, -3000][index % 6] ?? 0;

  return {
    id: `c${index + 1}`,
    values: {
      price: 70_000 + area * 5_800 + parking * 28_000 - age * 3_200 + noise,
      area,
      parking,
      age,
      elevator: index % 4 === 0
    }
  };
});

const variables: VariableDefinition[] = [
  {
    id: "price",
    label: "Valor",
    sourceField: "price",
    role: "target",
    kind: "numeric",
    transform: "none"
  },
  {
    id: "area",
    label: "Área privativa",
    sourceField: "area",
    role: "feature",
    kind: "numeric",
    transform: "none",
    required: true,
    expectedSign: "positive"
  },
  {
    id: "parking",
    label: "Vagas",
    sourceField: "parking",
    role: "feature",
    kind: "numeric",
    transform: "none",
    expectedSign: "positive"
  },
  {
    id: "age",
    label: "Idade",
    sourceField: "age",
    role: "feature",
    kind: "numeric",
    transform: "none",
    expectedSign: "negative"
  },
  {
    id: "elevator",
    label: "Elevador",
    sourceField: "elevator",
    role: "feature",
    kind: "binary",
    transform: "none",
    expectedSign: "positive"
  }
];

describe("valuation-core", () => {
  it("ranks a valid OLS model and predicts the subject value", () => {
    const result = runModelSearch({
      comparables,
      variables,
      subjectValues: {
        area: 92,
        parking: 1,
        age: 5,
        elevator: true
      },
      minVariables: 2,
      maxVariables: 4
    });

    const top = result.candidates[0];

    assert.ok(top);
    assert.equal(top.accepted, true);
    assert.equal(top.terms.some((term) => term.startsWith("area:")), true);
    assert.ok(top.diagnostics.adjustedR2 > 0.9);
    assert.ok((top.valuation?.estimate ?? 0) > 500_000);
    assert.equal(top.ruleChecks.every((check) => check.status !== "fail"), true);
  });

  it("rejects underdetermined candidate models", () => {
    const result = runModelSearch({
      comparables: comparables.slice(0, 4),
      variables,
      minVariables: 3,
      maxVariables: 4
    });

    assert.equal(result.candidates.some((candidate) => !candidate.accepted), true);
  });

  it("coerces common Brazilian numeric strings", () => {
    assert.equal(transformedNumber("1.234.567,89", "none"), 1234567.89);
    assert.equal(transformedNumber("350,5", "none"), 350.5);
  });

  it("infers the most likely variable kind from the observed data", () => {
    assert.equal(inferVariableKind([1, 0, 1, 1, 0, null]), "binary");
    assert.equal(inferVariableKind(["Sim", "Não", "Sim", "Não"]), "binary");
    assert.equal(inferVariableKind([52, 61, 75, 88, 104, 126]), "numeric");
    assert.equal(inferVariableKind(["Centro", "Jardins", "Vila Nova", "Centro"]), "categorical");
  });

  it("screens transformations and keeps a linearizing transform in the model search", () => {
    const transformedComparables: MarketComparable[] = Array.from({ length: 18 }, (_, index) => {
      const area = 45 + index * 7;

      return {
        id: `log-${index + 1}`,
        values: {
          price: 150_000 + 125_000 * Math.log(area),
          area
        }
      };
    });
    const transformedVariables: VariableDefinition[] = [
      {
        id: "price",
        label: "Valor",
        sourceField: "price",
        role: "target",
        kind: "numeric",
        transform: "none"
      },
      {
        id: "area",
        label: "Área",
        sourceField: "area",
        role: "feature",
        kind: "numeric",
        transform: "none",
        expectedSign: "positive"
      }
    ];
    const result = runModelSearch({
      comparables: transformedComparables,
      variables: transformedVariables,
      subjectValues: { area: 92 },
      minVariables: 1,
      maxVariables: 1
    });
    const top = result.candidates[0];

    assert.ok(top);
    assert.equal(top.accepted, true);
    assert.equal(top.terms.includes("area:log"), true);
    assert.ok(top.diagnostics.adjustedR2 > 0.999);
  });

  it("screens target transformations and rewrites the final equation on the original target scale", () => {
    const transformedTargetComparables: MarketComparable[] = Array.from({ length: 18 }, (_, index) => {
      const area = 20 + index * 4;

      return {
        id: `target-log-${index + 1}`,
        values: {
          price: Math.exp(8 + area * 0.05),
          area
        }
      };
    });
    const transformedTargetVariables: VariableDefinition[] = [
      {
        id: "price",
        label: "Valor",
        sourceField: "price",
        role: "target",
        kind: "numeric",
        transform: "none"
      },
      {
        id: "area",
        label: "Área",
        sourceField: "area",
        role: "feature",
        kind: "numeric",
        transform: "none",
        expectedSign: "positive"
      }
    ];
    const result = runModelSearch({
      comparables: transformedTargetComparables,
      variables: transformedTargetVariables,
      subjectValues: { area: 50 },
      minVariables: 1,
      maxVariables: 1
    });
    const top = result.candidates[0];

    assert.ok(top);
    assert.equal(top.accepted, true);
    assert.equal(top.equation.startsWith("Valor = exp("), true);
    assert.equal(top.equation.includes("log(Valor)"), false);
    assert.ok(Math.abs((top.valuation?.estimate ?? 0) - Math.exp(8 + 50 * 0.05)) < 1);
  });

  it("emits the photo checklist criteria and applies Table 1 micronumerosity", () => {
    const checklistResult = runModelSearch({
      comparables,
      variables,
      subjectValues: {
        area: 92,
        parking: 1,
        age: 5,
        elevator: true
      },
      minVariables: 2,
      maxVariables: 4
    });
    const checklistCandidate = checklistResult.candidates[0];
    const expectedCheckIds = [
      "variables-used",
      "observations-used",
      "degrees-of-freedom",
      "duplicate-data",
      "stale-data",
      "essential-variables-tested",
      "micronumerosity",
      "r2-minimum",
      "global-significance",
      "residual-normality",
      "term-significance",
      "student-t-dominance",
      "expected-signs",
      "heteroscedasticity",
      "max-relative-residual",
      "max-linear-residual-variation",
      "cook-distance-over-one",
      "independent-strong-correlation",
      "dependent-strong-correlation",
      "projection-inflection",
      "projection-interval-amplitude",
      "projection-extrapolation"
    ];

    assert.ok(checklistCandidate);
    for (const checkId of expectedCheckIds) {
      assert.ok(
        checklistCandidate.ruleChecks.some((check) => check.id === checkId),
        `missing ${checkId}`
      );
    }

    const rareBinaryComparables: MarketComparable[] = Array.from({ length: 31 }, (_, index) => ({
      id: `rare-${index + 1}`,
      values: {
        price: 200_000 + index * 10_000 + (index < 2 ? 50_000 : 0),
        area: 50 + index,
        rareView: index < 2
      }
    }));
    const rareBinaryVariables: VariableDefinition[] = [
      {
        id: "price",
        label: "Valor",
        sourceField: "price",
        role: "target",
        kind: "numeric",
        transform: "none"
      },
      {
        id: "rareView",
        label: "Vista rara",
        sourceField: "rareView",
        role: "feature",
        kind: "binary",
        transform: "none",
        required: true,
        expectedSign: "positive"
      }
    ];
    const rareResult = runModelSearch({
      comparables: rareBinaryComparables,
      variables: rareBinaryVariables,
      minVariables: 1,
      maxVariables: 1,
      autoTargetTransformSearch: false
    });
    const rareCandidate = rareResult.candidates[0];
    const micronumerosity = rareCandidate?.ruleChecks.find((check) => check.id === "micronumerosity");

    assert.ok(micronumerosity);
    assert.equal(micronumerosity.status, "fail");
    assert.equal(micronumerosity.threshold, "n_i >= 4");
  });
});
