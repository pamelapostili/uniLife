const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const tables = ['profiles','chats','messages','posts'];
  for (const t of tables) {
    const { data, error } = await supabase.rpc('information_schema_table_columns', { table_name: t }).catch(()=>null);
    if (error || !data) {
      console.log(`Could not fetch columns for ${t}. Falling back to SELECT LIMIT 1`);
      const { data: sample, error: e } = await supabase.from(t).select('*').limit(1);
      if (e) {
        console.log(`Table ${t} not found or inaccessible.`);
      } else {
        console.log(`Table ${t} exists. Sample columns: ${Object.keys(sample[0]||{})}`);
      }
      continue;
    }
    console.log(`${t} columns:`, data);
  }
}

check();
