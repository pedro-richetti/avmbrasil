const fs = require('fs');
let code = fs.readFileSync('packages/valuation-core/src/index.ts', 'utf8');
code = code.replace(
  `  const result: { dominant: boolean; value: string; message: string; dominantLabel?: string } = {
    dominant,
    value: max ? \\\`\\\${\\\max.label}: \\\${\\\round(max.value, 3)} / demais \\\${\\\round(othersSum, 3)}\\\` : "n/a",
    message: dominant && max
        ? \\\`\\\${\\\max.label} tem T de Student superior a 5 vezes a soma dos demais.\\\`
        : "Nenhum T de Student supera 5 vezes a soma dos demais."
  };
  if (dominant && max) {
    result.dominantLabel = max.label;
  }
  return result; // Replace rest of old return later
    value: max ? \`\${max.label}: \${round(max.value, 3)} / demais \${round(othersSum, 3)}\` : "n/a",
    message: dominant && max
        ? \`\${max.label} tem T de Student superior a 5 vezes a soma dos demais.\`
        : "Nenhum T de Student supera 5 vezes a soma dos demais."
  };`,
  `  const result: { dominant: boolean; value: string; message: string; dominantLabel?: string } = {
    dominant,
    value: max ? \`\${max.label}: \${round(max.value, 3)} / demais \${round(othersSum, 3)}\` : "n/a",
    message: dominant && max
        ? \`\${max.label} tem T de Student superior a 5 vezes a soma dos demais.\`
        : "Nenhum T de Student supera 5 vezes a soma dos demais."
  };
  if (dominant && max) {
    result.dominantLabel = max.label;
  }
  return result;`
);
fs.writeFileSync('packages/valuation-core/src/index.ts', code);
