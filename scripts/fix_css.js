const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// Buscamos líneas que solo tengan -webkit- y espacios
css = css.replace(/^[ \t]*-webkit-[ \t]*\r?\n/gm, '');

fs.writeFileSync('src/app/globals.css', css);
console.log('Fixed hanging -webkit- lines!');
