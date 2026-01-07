import { createClient } from '@supabase/supabase-js'

// Configuração via .env (Vite). Para DEV, aplicamos fallback seguro (public anon key) obtido via MCP.
const DEFAULT_URL = 'https://arzpudzioyzaovumldpz.supabase.co'
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenB1ZHppb3l6YW92dW1sZHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNzEzNDksImV4cCI6MjA3Njk0NzM0OX0.oBYnzUHDPtHZhzqfLIUhQRnqlajqHgeJLjsImIr6RAY'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON

// Este projeto usa Firebase Auth; Supabase aqui é principalmente para dados.
// Para evitar loops de refresh_token (que travam a UI com requisições repetidas),
// desativamos persistência/refresh automático de sessão.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})


