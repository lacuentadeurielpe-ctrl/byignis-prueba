const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const ferreteria_id = '32e14714-dfae-4a90-8cb9-41eb7d90a8d2';
  const nuevoEstado = 'suspendido';

  console.log("Updating suscripciones...");
  const { data, error } = await admin
    .from('suscripciones')
    .update({ estado: nuevoEstado })
    .eq('ferreteria_id', ferreteria_id)
    .select();

  console.log("Update Result:", { data, error });
}

run();
