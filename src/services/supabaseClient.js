import { createClient } from '@supabase/supabase-js'

// Em dev, use variáveis do Vite (prefira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
// Em produção, você pode injetar via ambiente do servidor/CI
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://arzpudzioyzaovumldpz.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)


