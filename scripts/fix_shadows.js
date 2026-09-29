const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// Fix Shadows that were missed due to multiline regex matching
css = css.replace(/0 8px 26px rgba\(44, 62, 45, 0\.05\)/g, '0 4px 14px rgba(44, 62, 45, 0.06)');
css = css.replace(/0 18px 40px rgba\([^)]+\)/g, '0 6px 18px rgba(44, 62, 45, 0.08)');
css = css.replace(/0 14px 40px rgba\([^)]+\)/g, '0 8px 24px rgba(44, 62, 45, 0.06)');

// Reduce padding in modal and other hover stuff if any missing
css = css.replace(/transform: scale\(1\.06\);/g, 'transform: scale(1.02);');

fs.writeFileSync('src/app/globals.css', css);
console.log('Fixed missing shadows!');
