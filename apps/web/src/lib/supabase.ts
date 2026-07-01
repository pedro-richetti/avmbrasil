import { createBrowserSupabaseClient } from "@avm/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createBrowserSupabaseClient({ url: supabaseUrl, anonKey: supabaseAnonKey }) : null;
