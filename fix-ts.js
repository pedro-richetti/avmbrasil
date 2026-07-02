const fs = require('fs');
let code = fs.readFileSync('packages/valuation-core/src/index.ts', 'utf8');

code = code.replace(
  `dominantLabel: dominant && max ? max.label : undefined`,
  `...(dominant && max ? { dominantLabel: max.label } : {})`
);

fs.writeFileSync('packages/valuation-core/src/index.ts', code);
