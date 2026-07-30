// Initializes and exports the Supabase client instance used across the app
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
