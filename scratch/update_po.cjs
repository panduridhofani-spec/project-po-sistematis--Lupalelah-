const fs = require('fs');

function updateFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  const parseStockHelper = `const parseStock = (val?: string | number) => {
  if (!val) return 0;
  const n = typeof val === 'number' ? val : parseFloat(val.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};\n\n`;

  if (!content.includes('const parseStock =')) {
    content = content.replace('export default function', parseStockHelper + 'export default function');
  }

  content = content.replace(/parseInt\(([^,]+?)\s*,\s*10\)/g, 'parseStock($1)');
  
  content = content.split('!/^\\d+$/.test').join('!/^[0-9.,]+$/.test');
  
  content = content.replace(/keyboardType="number-pad"/g, 'keyboardType="decimal-pad"');
  
  fs.writeFileSync(path, content);
}

updateFile('app/(logistics)/regular-po/[id].tsx');
updateFile('app/(logistics)/urgent-po/[id].tsx');
console.log('Done');
