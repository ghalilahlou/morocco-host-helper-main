// Script pour lister les tables de la base de données Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://csopyblkfyofwkeqqegd.supabase.co';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY non définie');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const query = `
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass)) as size
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE' 
ORDER BY table_name;
`;

console.log('📊 Listage des tables de la base de données...\n');

const { data, error } = await supabase.rpc('exec_sql', { query });

if (error) {
  console.error('❌ Erreur:', error.message);
  Deno.exit(1);
}

console.log(data);
