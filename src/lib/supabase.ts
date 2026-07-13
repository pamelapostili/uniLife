import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://xyyhianihpeutfvuuwfr.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5eWhpYW5paHBldXRmdnV1d2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNjcyNDAsImV4cCI6MjA5ODk0MzI0MH0.RB8bAX9w9wBIZ8rs2FN_H2h6CESTUkibELDKWBpMkDo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: AsyncStorage as any,
  },
});
