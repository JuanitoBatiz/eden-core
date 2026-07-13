const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.join(__dirname, '../public/images');
const srcDir = path.join(__dirname, '../src');

async function convertImages() {
  if (!fs.existsSync(imagesDir)) {
    console.error('El directorio public/images no existe.');
    return;
  }

  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

  console.log(`\n🚀 Iniciando conversión de ${imageFiles.length} imágenes a .webp de máxima calidad...\n`);

  let totalOldSize = 0;
  let totalNewSize = 0;
  const convertedMap = {}; // oldFileName -> newFileName

  for (const file of imageFiles) {
    const oldPath = path.join(imagesDir, file);
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    const newFileName = `${baseName}.webp`;
    const newPath = path.join(imagesDir, newFileName);

    const oldStats = fs.statSync(oldPath);
    totalOldSize += oldStats.size;

    try {
      // Redimensionar suavemente si es gigantesca (>1400px ancho o alto) y convertir a webp alta calidad
      await sharp(oldPath)
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 6 })
        .toFile(newPath);

      const newStats = fs.statSync(newPath);
      totalNewSize += newStats.size;

      const oldMB = (oldStats.size / (1024 * 1024)).toFixed(2);
      const newMB = (newStats.size / (1024 * 1024)).toFixed(2);
      const savedPct = ((1 - newStats.size / oldStats.size) * 100).toFixed(1);

      console.log(`✅ ${file} (${oldMB} MB) ➔ ${newFileName} (${newMB} MB) | Ahorro: ${savedPct}%`);

      convertedMap[file] = newFileName;

      // Borrar la imagen pesada original después de confirmar que el .webp se creó correctamente
      fs.unlinkSync(oldPath);
    } catch (err) {
      console.error(`❌ Error al convertir ${file}:`, err.message);
    }
  }

  const totalOldMB = (totalOldSize / (1024 * 1024)).toFixed(2);
  const totalNewMB = (totalNewSize / (1024 * 1024)).toFixed(2);
  const totalSavedPct = ((1 - totalNewSize / totalOldSize) * 100).toFixed(1);

  console.log(`\n📊 RESULTADO TOTAL:`);
  console.log(`📦 Peso anterior: ${totalOldMB} MB`);
  console.log(`🪶 Nuevo peso (.webp): ${totalNewMB} MB`);
  console.log(`⚡ Ahorro total de red: ${totalSavedPct}% (${(totalOldMB - totalNewMB).toFixed(2)} MB eliminados)\n`);

  console.log(`🔄 Actualizando referencias en el código fuente (src/)...`);

  function updateReferencesInDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        updateReferencesInDir(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let hasChanges = false;

        for (const [oldName, newName] of Object.entries(convertedMap)) {
          const regex = new RegExp(`/images/${oldName}`, 'g');
          if (regex.test(content)) {
            content = content.replace(regex, `/images/${newName}`);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`📝 Referencias actualizadas en: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
        }
      }
    }
  }

  updateReferencesInDir(srcDir);
  console.log(`\n✨ ¡Proceso completado con éxito! Las imágenes ahora son ultra veloces.\n`);
}

convertImages();
