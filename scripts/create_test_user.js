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
    const email = `test+${Date.now()}@example.com`;
    const password = 'Passw0rd!';

    // Use admin API to create a user and mark email as confirmed
    const res = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    console.log('RESULT', JSON.stringify(res, null, 2));

    if (res.data?.user) {
      console.log('User created:', res.data.user.id, res.data.user.email);
    } else {
      console.error('No user created.');
    }
  } catch (err) {
    console.error('ERROR', err);
  }
})();
