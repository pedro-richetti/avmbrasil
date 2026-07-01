import type { MarketComparable, SubjectProperty, VariableDefinition } from "@avm/domain";

const rows = [
  [1, 520000, 72, 2, 1, 8, 950, "Centro"],
  [2, 610000, 84, 3, 1, 5, 720, "Centro"],
  [3, 760000, 108, 3, 2, 3, 520, "Jardins"],
  [4, 690000, 96, 3, 2, 12, 640, "Jardins"],
  [5, 450000, 61, 2, 1, 18, 1100, "Centro"],
  [6, 830000, 124, 4, 2, 4, 380, "Jardins"],
  [7, 580000, 79, 2, 1, 9, 780, "Vila Nova"],
  [8, 925000, 136, 4, 3, 2, 300, "Jardins"],
  [9, 500000, 68, 2, 1, 15, 980, "Vila Nova"],
  [10, 705000, 101, 3, 2, 6, 580, "Centro"],
  [11, 390000, 54, 1, 1, 22, 1300, "Vila Nova"],
  [12, 880000, 130, 4, 2, 7, 360, "Jardins"],
  [13, 650000, 90, 3, 1, 10, 700, "Centro"],
  [14, 735000, 112, 3, 2, 11, 540, "Vila Nova"],
  [15, 970000, 146, 4, 3, 1, 260, "Jardins"],
  [16, 560000, 76, 2, 1, 14, 860, "Centro"]
] as const;

export const sampleComparables: MarketComparable[] = rows.map(([id, price, area, bedrooms, parking, age, distancePark, neighborhood]) => ({
  id: `cmp-${id}`,
  address: `Amostra ${id}`,
  source: "Dataset demo",
  capturedAt: "2026-06-01",
  values: {
    price,
    area,
    bedrooms,
    parking,
    age,
    distancePark,
    neighborhood
  }
}));

export const sampleSubject: SubjectProperty = {
  id: "subject-demo",
  projectId: "project-demo",
  address: "Rua Exemplo, 123",
  city: "São Paulo",
  state: "SP",
  propertyType: "Apartamento",
  values: {
    area: 98,
    bedrooms: 3,
    parking: 2,
    age: 6,
    distancePark: 610,
    neighborhood: "Centro"
  }
};

export const sampleVariables: VariableDefinition[] = [
  {
    id: "price",
    label: "Valor ofertado",
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
    id: "bedrooms",
    label: "Dormitórios",
    sourceField: "bedrooms",
    role: "feature",
    kind: "numeric",
    transform: "none",
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
    id: "distancePark",
    label: "Distância ao parque",
    sourceField: "distancePark",
    role: "feature",
    kind: "numeric",
    transform: "none",
    expectedSign: "negative"
  },
  {
    id: "neighborhood",
    label: "Bairro",
    sourceField: "neighborhood",
    role: "feature",
    kind: "categorical",
    transform: "none"
  }
];

export const sampleCsv = [
  "price,area,bedrooms,parking,age,distancePark,neighborhood",
  ...sampleComparables.map((row) =>
    [
      row.values.price,
      row.values.area,
      row.values.bedrooms,
      row.values.parking,
      row.values.age,
      row.values.distancePark,
      row.values.neighborhood
    ].join(",")
  )
].join("\n");
