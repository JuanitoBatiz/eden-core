const fs = require('fs');
const files = [
  'src/app/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/become-cashier/page.tsx',
  'src/app/become-owner/page.tsx',
  'src/app/orden/[id]/page.tsx'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\/logo\.png/g, '/images/logo_eden2.png');
  fs.writeFileSync(file, content);
}
console.log('Logo replaced in all files!');
