const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// The broken block:
//   28% {
//     left: 160%;
//   }
//   100% {
//     left: 160%;
//   }
// }

const brokenRegex = /\s*28% \{\s*left: 160%;\s*\}\s*100% \{\s*left: 160%;\s*\}\s*\}/;

if (brokenRegex.test(css)) {
  css = css.replace(brokenRegex, '');
  fs.writeFileSync('src/app/globals.css', css);
  console.log('Fixed hanging keyframe braces!');
} else {
  console.log('Regex did not match.');
}
