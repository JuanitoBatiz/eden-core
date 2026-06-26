import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  const { data, error } = await supabase.from('users').select('id, phone, name, role');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users in DB:', data);
  }
}

listUsers();
