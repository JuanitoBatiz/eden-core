import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function swapFilesAndDB() {
  const imagesDir = path.resolve(process.cwd(), 'public', 'images');
  const burritoPath = path.join(imagesDir, 'burrito.webp');
  const rollitoPath = path.join(imagesDir, 'rollito3.webp');
  const tempPath = path.join(imagesDir, 'temp_swap.webp');

  console.log('🔄 Intercambiando archivos físicos burrito.webp <-> rollito3.webp...');
  if (fs.existsSync(burritoPath) && fs.existsSync(rollitoPath)) {
    fs.renameSync(burritoPath, tempPath);
    fs.renameSync(rollitoPath, burritoPath);
    fs.renameSync(tempPath, rollitoPath);
    console.log('✅ Archivos físicos intercambiados correctamente.');
  } else {
    console.error('❌ No se encontraron ambos archivos en public/images/');
  }

  // Actualizar en Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🔄 Sincronizando Supabase DB con los nombres correctos...');
    
    await supabase
      .from('products')
      .update({ image_url: '/images/burrito.webp' })
      .ilike('name', '%burrito%');

    await supabase
      .from('products')
      .update({ image_url: '/images/rollito3.webp' })
      .ilike('name', '%mixto%')
      .ilike('name', '%rollito%');

    console.log('✅ Supabase DB sincronizado: Burrito -> burrito.webp | Rollitos Mixtos -> rollito3.webp');
  }
}

swapFilesAndDB();
