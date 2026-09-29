const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// Cambiar Verde Salvia (Sage) por Arena/Taupe Cálido
css = css.replace(/--color-ochre: #8C9A83;/g, '--color-ochre: #B0A89A;'); 
css = css.replace(/--color-ochre-light: #E8EBE4;/g, '--color-ochre-light: #F0EDE6;');

fs.writeFileSync('src/app/globals.css', css);
console.log('Accent color changed to Taupe/Arena!');
