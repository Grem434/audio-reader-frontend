    import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Esto te ahorra horas: sin estas envs no hay auth.
  // En dev lo verás en consola inmediatamente.
  // En prod (Netlify) también.
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el frontend.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
