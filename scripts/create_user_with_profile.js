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

    const res = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    console.log('CREATE RESULT', JSON.stringify(res, null, 2));

    const userId = res.data?.user?.id;
    if (!userId) {
      console.error('No user id returned.');
      return;
    }

    const full_name = email.split('@')[0];

    const { data: profileData, error: profErr } = await supabase.from('profiles').upsert({
      id: userId,
      full_name,
      avatar_url: `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(full_name)}`
    });

    if (profErr) {
      console.error('Profile upsert error', profErr);
    } else {
      console.log('Profile upserted', profileData);
    }

    console.log('User credentials:');
    console.log('email:', email);
    console.log('password:', password);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
