import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- BUSCANDO USUARIOS ---');
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const users = usersData?.users || [];
  
  const orlando = users.find(u => u.email && u.email.includes('orlando'));
  const foxpdf = users.find(u => u.email && u.email.includes('foxpdf'));
  
  console.log('Orlando:', orlando?.email, '| ID:', orlando?.id);
  console.log('Foxpdf:', foxpdf?.email, '| ID:', foxpdf?.id);
  
  console.log('\n--- BUSCANDO FERRETERIAS ---');
  const { data: ferrs } = await supabase.from('ferreterias')
    .select('id, owner_id, nombre, ruc, razon_social')
    .in('owner_id', [orlando?.id, foxpdf?.id].filter(Boolean));
    
  console.log(JSON.stringify(ferrs, null, 2));
  
  const fIds = ferrs?.map(f => f.id) || [];
  
  console.log('\n--- BUSCANDO CREDENCIALES SUNAT ---');
  const { data: creds } = await supabase.from('sunat_credenciales')
    .select('id, ferreteria_id, ruc, modo, estado, created_at, updated_at')
    .in('ferreteria_id', fIds);
    
  console.log(JSON.stringify(creds, null, 2));
}

check().catch(console.error);
