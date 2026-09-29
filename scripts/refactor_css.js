const fs = require('fs');

let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// FASE 1: Glassmorphism
css = css.replace(/backdrop-filter: blur\(20px\) saturate\(180\%\);/g, 'backdrop-filter: blur(10px) saturate(120%);');
css = css.replace(/-webkit-backdrop-filter: blur\(20px\) saturate\(180\%\);/g, '-webkit-backdrop-filter: blur(10px) saturate(120%);');

css = css.replace(/backdrop-filter: blur\(24px\) saturate\(190\%\);/g, 'backdrop-filter: blur(10px) saturate(120%);');
css = css.replace(/-webkit-backdrop-filter: blur\(24px\) saturate\(190\%\);/g, '-webkit-backdrop-filter: blur(10px) saturate(120%);');

// Tarjetas Editoriales Glassmorphism -> Sólido
css = css.replace(/background: rgba\(253, 251, 247, 0.78\);/g, 'background: var(--color-cream-light);');
css = css.replace(/backdrop-filter: blur\(18px\) saturate\(160\%\);/g, '');
css = css.replace(/-webkit-backdrop-filter: blur\(18px\) saturate\(160\%\);/g, '');

css = css.replace(/background: linear-gradient\(135deg, rgba\(255, 255, 255, 0.88\) 0\%, rgba\(253, 251, 247, 0.75\) 100\%\);/g, 'background: linear-gradient(135deg, #ffffff 0%, var(--color-cream-light) 100%);');

css = css.replace(/background: rgba\(255, 255, 255, 0.82\);/g, 'background: var(--color-white);');
css = css.replace(/backdrop-filter: blur\(16px\);/g, '');
css = css.replace(/-webkit-backdrop-filter: blur\(16px\);/g, '');

css = css.replace(/backdrop-filter: blur\(8px\);/g, ''); // modals

// Sombras
// Tarjetas
css = css.replace(/box-shadow: \n    0 8px 26px rgba\(44, 62, 45, 0.05\),\n    inset 0 1px 1px rgba\(255, 255, 255, 0.95\);/g, 'box-shadow: 0 4px 14px rgba(44, 62, 45, 0.06);');
css = css.replace(/box-shadow: \n    0 18px 40px rgba\(212, 163, 95, 0.22\),\n    inset 0 1px 2px rgba\(255, 255, 255, 1\);/g, 'box-shadow: 0 6px 18px rgba(44, 62, 45, 0.08);');

css = css.replace(/box-shadow: \n    0 14px 40px rgba\(44, 62, 45, 0.08\),\n    inset 0 1px 2px rgba\(255, 255, 255, 1\);/g, 'box-shadow: 0 8px 24px rgba(44, 62, 45, 0.06);');

// Modales
css = css.replace(/box-shadow: 0 28px 70px rgba\(28, 43, 33, 0.22\);/g, 'box-shadow: 0 16px 40px rgba(28, 43, 33, 0.12);');

// Botones
css = css.replace(/box-shadow: 0 8px 28px rgba\(0, 0, 0, 0.18\), inset 0 1px 1px rgba\(255, 255, 255, 0.3\);/g, 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.3);');
css = css.replace(/box-shadow: 0 14px 36px rgba\(0, 0, 0, 0.25\), 0 0 26px rgba\(255, 255, 255, 0.22\);/g, 'box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.5);');


// Shimmers
css = css.replace(/animation: cardFullShimmerSweep 4.8s cubic-bezier\(0.4, 0, 0.2, 1\) infinite;/g, 'animation: subtleLoadShimmer 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;');
css = css.replace(/animation-duration: 4.2s;/g, '');
css = css.replace(/animation: badgeShimmerSweep 3.8s cubic-bezier\(0.4, 0, 0.2, 1\) infinite;/g, 'display: none;');

const newKeyframes = `
@keyframes subtleLoadShimmer {
  0% { left: -150%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 160%; opacity: 0; }
}
`;
css = css.replace(/@keyframes cardFullShimmerSweep \{[\s\S]*?\}/, newKeyframes);

// FASE 2: Border radius, Espaciado, Hovers
// Border Radius
css = css.replace(/border-radius: 26px;/g, 'border-radius: 16px;');
// Modal and category chips from 30px to 16/20
css = css.replace(/border-radius: 30px;/g, 'border-radius: 16px;');
// Inputs 12px -> 10px
css = css.replace(/border-radius: 12px;/g, 'border-radius: 10px;');

// Excepciones pill para botones hero y cart
css = css.replace(/\.hero-cta-btn \{/g, '.hero-cta-btn {\n  border-radius: 100px !important;');
css = css.replace(/\.cart-icon-btn \{/g, '.cart-icon-btn {\n  border-radius: 100px !important;');
css = css.replace(/\.confirm-add-btn \{/g, '.confirm-add-btn {\n  border-radius: 100px !important;');
css = css.replace(/\.modal-content \{/g, '.modal-content {\n  border-radius: 20px !important;');

// Hovers (Translate, Scale, Rotate)
css = css.replace(/transform: translateY\(-7px\);/g, 'transform: translateY(-3px);');
css = css.replace(/transform: translateY\(-6px\);/g, 'transform: translateY(-3px);');
css = css.replace(/transform: scale\(1.08\);/g, ''); // Icon wrapper scale hover
css = css.replace(/transform: scale\(1.06\);/g, 'transform: scale(1.02);');

// Espaciado
css = css.replace(/padding: 30px 0 60px 0;/g, 'padding: 50px 0 80px 0;');
css = css.replace(/gap: 36px;/g, 'gap: 42px;'); // bento grid tablet
css = css.replace(/gap: 42px;/g, 'gap: 52px;'); // bento grid desktop
css = css.replace(/padding: 26px 24px;/g, 'padding: 32px 28px;'); // editorial-info
css = css.replace(/padding: 32px 30px;/g, 'padding: 40px 36px;'); // hero editorial

// Typography Weights
css = css.replace(/font-weight: 800;/g, 'font-weight: 700;');

// Transitions (reduce bounce/duration)
css = css.replace(/transition: opacity 520ms/g, 'transition: opacity 400ms');
css = css.replace(/transform 520ms/g, 'transform 400ms');
css = css.replace(/transition: opacity 480ms/g, 'transition: opacity 350ms');
css = css.replace(/transform 580ms/g, 'transform 400ms');

fs.writeFileSync('src/app/globals.css', css);
console.log('Done CSS modifications!');
