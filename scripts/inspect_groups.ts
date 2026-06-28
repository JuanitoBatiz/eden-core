import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function inspect() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: groups } = await supabase.from('modifier_groups').select('*').ilike('name', '%aderezo%');
  console.log('Aderezo groups in DB:', JSON.stringify(groups, null, 2));
}

inspect();
