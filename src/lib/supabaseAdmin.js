import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para uso EXCLUSIVO del servidor (rutas de API en
// src/app/api/...): usa la Service Role Key, que ignora RLS. NUNCA importar
// este archivo desde un componente de cliente ("use client") ni exponer
// SUPABASE_SERVICE_ROLE_KEY al navegador — es lo que nos permite, por
// ejemplo, leer el token de Mercado Pago de un negocio para cobrarle a un
// cliente anónimo que todavía no tiene sesión.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
