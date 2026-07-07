const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

(async () => {
  try {
    // Find the most recently created test user
    const { data: users, error: uerr } = await supabase.auth.admin.listUsers({ limit: 10 });
    if (uerr) {
      console.error('Error listing users', uerr);
      return;
    }
    const testUser = users[0];
    if (!testUser) {
      console.error('No users found to add profile for.');
      return;
    }
    const id = testUser.id;
    const full_name = testUser.email?.split('@')[0] || 'Test User';

    const { data, error } = await supabase.from('profiles').upsert({ id, full_name, avatar_url: `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(full_name)}` });
    if (error) {
      console.error('Upsert error', error);
    } else {
      console.log('Profile upserted for', id, data);
    }
  } catch (err) {
    console.error('Error', err);
  }
})();
