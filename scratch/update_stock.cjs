const fs = require('fs');
let content = fs.readFileSync('app/(barista)/stock-taking.tsx', 'utf8');

const parseStockHelper = `const parseStock = (val?: string) => {
  if (!val) return 0;
  const n = parseFloat(val.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};\n\n`;

if (!content.includes('const parseStock =')) {
  content = content.replace('export default function StockTakingScreen() {', parseStockHelper + 'export default function StockTakingScreen() {');
}

content = content.replace(/parseInt\(([^,]+?)\s*,\s*10\)/g, 'parseStock($1)');
content = content.replace(/\/^\^\\\\d\+\$\/\.test/g, '/^[0-9.,]+$/.test'); // fix regex
content = content.replace(/! \/^\^\\\\d\+\$\/\.test/g, '!/^[0-9.,]+$/.test');
content = content.replace(/!\/^\^\\\\d\+\$\/\.test/g, '!/^[0-9.,]+$/.test');
content = content.replace(/!\/\\^\\\\d\\+\\$\/.test/g, '!/^[0-9.,]+$/.test');
content = content.replace(/!\/\\^\\d\+\$\/.test/g, '!/^[0-9.,]+$/.test');

// Let's just do simple replace for the regex:
content = content.split('!/^\\d+$/.test').join('!/^[0-9.,]+$/.test');


content = content.replace(/keyboardType="number-pad"/g, 'keyboardType="decimal-pad"');

fs.writeFileSync('app/(barista)/stock-taking.tsx', content);
console.log("Done");
