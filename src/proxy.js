import { NextResponse } from "next/server";

// Dominio propio por negocio (ej. "turnos.minegocio.com.ar" o
// "demo.agenda-estudio.com.ar"): cuando alguien entra por un dominio que
// está cargado en la columna "negocios.dominio", le mostramos la página de
// reservas de ESE negocio en la raíz ("/"), sin que se vea el slug en la URL.
// Los dominios de la plataforma (*.vercel.app, localhost) siguen funcionando
// igual que siempre: /slug para cada negocio.
//
// Para sumar un dominio nuevo no hace falta tocar código: se agrega el
// dominio al proyecto en Vercel y se carga en la fila del negocio (ver
// claude/playbook-alta-negocio.md, Paso 6).

// Cuánto tiempo recordamos a qué negocio corresponde cada dominio, para no
// consultar a Supabase en cada visita.
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

function esDominioDeLaPlataforma(host) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
}

// Rutas que funcionan igual en cualquier dominio: el panel, la API y los
// archivos (imágenes, íconos, etc.).
function esRutaCompartida(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/_next/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

async function buscarSlugPorDominio(host) {
  const enCache = cache.get(host);
  if (enCache && enCache.expira > Date.now()) return enCache.slug;

  // "www.x.com.ar" y "x.com.ar" son el mismo negocio: se carga sin "www."
  const dominio = host.replace(/^www\./, "");
  let slug = null;
  try {
    const respuesta = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/negocios?dominio=eq.${encodeURIComponent(dominio)}&select=slug&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (respuesta.ok) {
      const filas = await respuesta.json();
      slug = filas[0]?.slug || null;
    } else {
      console.error("Error buscando el negocio del dominio", dominio, respuesta.status);
      return null; // no lo guardamos en cache: reintenta en la próxima visita
    }
  } catch (error) {
    console.error("Error buscando el negocio del dominio", dominio, error);
    return null;
  }

  cache.set(host, { slug, expira: Date.now() + CACHE_MS });
  return slug;
}

export async function proxy(request) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname, search } = request.nextUrl;

  if (!host || esDominioDeLaPlataforma(host) || esRutaCompartida(pathname)) {
    return NextResponse.next();
  }

  const slug = await buscarSlugPorDominio(host);
  if (!slug) return NextResponse.next();

  // Si llega a "/slug" (por ejemplo, la vuelta de Mercado Pago, que arma la
  // URL con el slug), lo mandamos a la raíz conservando los parámetros
  // (?pago=...&reserva=...), para que la URL quede prolija.
  if (pathname === `/${slug}`) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Cualquier otra ruta del dominio muestra la página del negocio (cada
  // dominio tiene una sola página pública: la de reservas).
  const url = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
