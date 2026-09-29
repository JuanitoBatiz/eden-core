const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// The original yellow/golden RGB values are hardcoded in the file inside rgba()
// #D4A35F is rgb(212, 163, 95)
// Sometimes it's written as 212, 163, 115
// We want to replace it with Taupe #B0A89A which is rgb(176, 168, 154)

css = css.replace(/212,\s*163,\s*95/g, '176, 168, 154');
css = css.replace(/212,\s*163,\s*115/g, '176, 168, 154');

fs.writeFileSync('src/app/globals.css', css);
console.log('Hardcoded yellow RGBs replaced with Taupe RGBs!');
