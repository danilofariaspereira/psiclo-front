/**
 * Singleton do cliente Supabase para o front-end.
 * Usa apenas a anon key — RLS garante o isolamento.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wdqqgomhzakkxycirvxp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qnHkY9E1P2XwSnCawneNiA_SHDuc3iMp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
