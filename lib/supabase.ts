import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * For API routes: builds a Supabase client scoped to the caller's bearer token,
 * so RLS policies (auth.uid()) apply and .auth.getUser() returns the real caller.
 */
export function createScopedClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export interface Conversation {
  id: string;
  created_at: string;
  title: string;
  updated_at: string;
}

export interface Message {
  id: string;
  created_at: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
}

export interface UserProfile {
  id: string;
  created_at: string;
  name: string;
  preferences: Record<string, unknown>;
}
