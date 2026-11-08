import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ACTUALIZADO } from "@/lib/textosLegales";

// Página de texto legal de un negocio ("condiciones" o "privacidad").
// En un dominio propio (ej. turnos.minegocio.com.ar) la web de reservas vive
// en "/", y en los de la plataforma (localhost, *.vercel.app) en "/slug"
// (ver src/proxy.js): los links se arman según desde dónde se entró.

function esDominioDeLaPlataforma(host) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
}

export async function cargarNegocio(slug) {
  const { data } = await supabase.from("negocios").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export default async function PaginaLegal({ slug, negocio, texto, otra }) {
  if (!negocio) notFound();

  const host = ((await headers()).get("host") || "").split(":")[0].toLowerCase();
  const base = esDominioDeLaPlataforma(host) ? `/${slug}` : "";
  const colorPrimario = negocio.color_primario || "#D9A79C";
  const colorSecundario = negocio.color_secundario || "#3A2E2A";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12" style={{ color: colorSecundario }}>
      <a href={base || "/"} className="text-sm font-medium" style={{ color: colorPrimario }}>
        ← Volver a {negocio.nombre}
      </a>
      <h1 className="mt-6 text-3xl font-semibold">{texto.titulo}</h1>
      <p className="mt-2 text-sm opacity-70">
        {negocio.nombre} · Última actualización: {ACTUALIZADO}
      </p>

      {texto.secciones.map((seccion) => (
        <section key={seccion.titulo} className="mt-8">
          <h2 className="text-lg font-semibold">{seccion.titulo}</h2>
          {seccion.lista && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
              {seccion.lista.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {(seccion.parrafos || []).map((parrafo) => (
            <p key={parrafo} className="mt-2 text-[15px] leading-relaxed">
              {parrafo}
            </p>
          ))}
        </section>
      ))}

      <p className="mt-10 border-t pt-6 text-sm">
        <a href={`${base}/${otra.ruta}`} className="underline underline-offset-4">
          {otra.titulo}
        </a>
      </p>
    </main>
  );
}
