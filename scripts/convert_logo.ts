import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

async function convertLogo() {
  const inputPath = path.resolve(process.cwd(), 'public', 'logo.png');
  const outputPath = path.resolve(process.cwd(), 'public', 'images', 'logo.webp');
  const rootOutputPath = path.resolve(process.cwd(), 'public', 'logo.webp');

  if (!fs.existsSync(inputPath)) {
    console.error('❌ No se encontró public/logo.png');
    return;
  }

  console.log('⏳ Convirtiendo public/logo.png a .webp...');
  await sharp(inputPath)
    .webp({ quality: 85 })
    .toFile(outputPath);

  await sharp(inputPath)
    .webp({ quality: 85 })
    .toFile(rootOutputPath);

  console.log('✅ Logo convertido exitosamente:');
  console.log('   - public/images/logo.webp');
  console.log('   - public/logo.webp');
}

convertLogo();
