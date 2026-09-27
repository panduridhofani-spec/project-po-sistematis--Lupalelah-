const fs = require('fs');
const path = require('path');

const files = [
  'app/(admin)/categories.tsx',
  'app/(admin)/products.tsx',
  'app/(admin)/shifts.tsx',
  'app/(admin)/users.tsx',
  'app/(barista)/profile.tsx',
  'app/(barista)/regular-po/create.tsx',
  'app/(barista)/regular-po/[id].tsx',
  'app/(barista)/stock-taking.tsx',
  'app/(barista)/urgent-po/create.tsx',
  'app/(barista)/urgent-po/[id].tsx',
  'app/(logistics)/regular-po/[id].tsx',
  'app/(logistics)/urgent-po/[id].tsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import for AppAlert if not exists
    if (!content.includes('import { AppAlert }')) {
      const depth = file.split('/').length - 1;
      const relativePrefix = '../'.repeat(depth);
      const importStatement = `import { AppAlert } from '${relativePrefix}src/components/AppAlert';\n`;
      
      // insert after the last import
      const lastImportIndex = content.lastIndexOf('import ');
      const endOfLastImport = content.indexOf('\n', lastImportIndex) + 1;
      content = content.slice(0, endOfLastImport) + importStatement + content.slice(endOfLastImport);
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Added import to ${file}`);
    }
  }
});
