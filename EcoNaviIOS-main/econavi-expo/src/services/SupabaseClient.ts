import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkcoimraewnwxhcmcomq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rY29pbXJhZXdud3hoY21jb21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODI1OTcsImV4cCI6MjA4NDY1ODU5N30.PfTPf5179KGFcPVqVKKRnGE0Mev1JWe_YgX5lQgIvxM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const signInAutomatically = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // If no existing session, sign in via an anonymous guest session or dummy user. 
    // To satisfy RLS for trips without a full Auth UI, we use anonymous sign in if allowed, or a default account.
    // Assuming anonymous sign-ins are enabled on this Supabase project. If not, this might fail and require an Auth flow.
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
       console.log('Anon sign in failed, trying fallback test account...', error.message);
       await supabase.auth.signInWithPassword({
         email: 'eco.knight@example.com',
         password: 'password123'
       }).catch(e => console.error(e));
    }
  }
};
