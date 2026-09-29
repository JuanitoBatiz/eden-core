const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// Cambiar Ocre (Dorado/Amarillo) por Verde Salvia (Sage Green)
css = css.replace(/--color-ochre: #D4A35F;/g, '--color-ochre: #8C9A83;'); 
css = css.replace(/--color-ochre-light: #F3E5D0;/g, '--color-ochre-light: #E8EBE4;');

fs.writeFileSync('src/app/globals.css', css);
console.log('Accent color changed to Sage Green!');
