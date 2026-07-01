import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function createBrowserSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey);
}

export function hasSupabaseConfig(config: Partial<SupabaseConfig>): config is SupabaseConfig {
  return Boolean(config.url && config.anonKey);
}

export const storageBuckets = {
  imports: "valuation-imports",
  evidence: "valuation-evidence",
  reports: "valuation-reports"
} as const;
