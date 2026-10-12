"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNegocioAutenticado } from "../../lib/useNegocioAutenticado";
import { colorDeMarca, fuenteDeMarca } from "../../lib/marcaNegocio";

// Secciones del panel, en el orden en que aparecen en el menú.
const SECCIONES = [
  { href: "/admin", label: "Agenda" },
  { href: "/admin/senas", label: "Señas" },
  { href: "/admin/horarios", label: "Horarios y bloqueos" },
  { href: "/admin/servicios", label: "Servicios y equipo" },
  { href: "/admin/sucursales", label: "Sucursales" },
  { href: "/admin/configuracion", label: "Configuración" },
];

function iniciales(nombre) {
  return (nombre || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join("")
    .toLowerCase();
}

// Link a la web de reservas del negocio: su dominio propio si tiene uno,
// si no la ruta /slug de la plataforma.
function urlWebDeReservas(negocio) {
  return negocio.dominio ? `https://${negocio.dominio}` : `/${negocio.slug}`;
}

function Marca({ negocio }) {
  const color = colorDeMarca(negocio);
  return (
    <div className="flex items-center gap-3">
      {negocio.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={negocio.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white"
          style={{ backgroundColor: color, fontFamily: fuenteDeMarca(negocio) }}
        >
          {iniciales(negocio.nombre)}
        </div>
      )}
      <div className="min-w-0">
        <div
          className="truncate text-2xl leading-none text-[#1E1B1A]"
          style={{ fontFamily: fuenteDeMarca(negocio) }}
        >
          {negocio.nombre}
        </div>
        <div className="mt-1 text-xs text-[#6B6461]">Panel del negocio</div>
      </div>
    </div>
  );
}

function PantallaLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorLogin, setErrorLogin] = useState(null);
  const [enviandoLogin, setEnviandoLogin] = useState(false);

  const manejarLogin = async (evento) => {
    evento.preventDefault();
    setEnviandoLogin(true);
    setErrorLogin(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setEnviandoLogin(false);

    if (error) {
      setErrorLogin("Email o contraseña incorrectos.");
    }
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#F6F4F1] px-4 text-[#1E1B1A]"
      style={{ fontFamily: "var(--font-panel)" }}
    >
      <div className="text-center">
        <h1 className="text-5xl" style={{ fontFamily: "var(--font-titulo)" }}>
          Tu panel
        </h1>
        <p className="mt-2 text-[#6B6461]">Entrá para ver tu agenda.</p>
      </div>
      <form
        onSubmit={manejarLogin}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[#ECE6E0] bg-white p-6"
      >
        <label className="flex flex-col gap-1.5 text-sm text-[#5B5451]">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded-xl border border-[#DCD5CE] px-3 text-base text-[#1E1B1A] focus:border-[#1E1B1A] focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[#5B5451]">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 rounded-xl border border-[#DCD5CE] px-3 text-base text-[#1E1B1A] focus:border-[#1E1B1A] focus:outline-none"
            required
          />
        </label>
        {errorLogin && <p className="text-sm text-red-700">{errorLogin}</p>}
        <button
          type="submit"
          disabled={enviandoLogin}
          className="min-h-11 rounded-full bg-[#1E1B1A] px-6 font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {enviandoLogin ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p className="text-xs text-[#6B6461]">
        Agenda <span style={{ fontFamily: "var(--font-titulo)" }} className="text-sm italic">estudio</span>
      </p>
    </main>
  );
}

// Layout compartido por todas las pantallas del panel: pantalla de login si
// no hay sesión, menú lateral con la marca del negocio (arriba, desplegable,
// en el celular), título de la sección, y el contenido propio de cada
// pantalla (vía render prop, recibe el negocio ya cargado).
//
// sinTarjeta: la pantalla arma su propio fondo/tarjetas (ej. la Agenda); si
// no, el contenido va dentro de una tarjeta blanca.
export default function AdminShell({ children, sinTarjeta = false }) {
  const { cargandoSesion, sesion, negocio, setNegocio, cargandoNegocio, errorNegocio, cerrarSesion } =
    useNegocioAutenticado();

  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (cargandoSesion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F4F1]" style={{ fontFamily: "var(--font-panel)" }}>
        <p className="text-[#6B6461]">Cargando...</p>
      </main>
    );
  }

  if (!sesion) {
    return <PantallaLogin />;
  }

  const seccionActual = SECCIONES.find((seccion) => seccion.href === pathname);

  return (
    <div
      className="flex min-h-screen flex-col bg-[#F6F4F1] text-[#1E1B1A] md:flex-row"
      style={{ fontFamily: "var(--font-panel)" }}
    >
      <aside className="border-b border-[#ECE6E0] bg-[#FBFAF8] md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-5 md:py-7">
          {negocio ? <Marca negocio={negocio} /> : <span className="text-[#6B6461]">Panel del negocio</span>}
          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-expanded={menuAbierto}
            aria-controls="menu-panel"
            className="min-h-11 rounded-full border border-[#DCD5CE] bg-white px-4 text-sm md:hidden"
          >
            {menuAbierto ? "Cerrar" : "Menú"}
          </button>
        </div>

        <div id="menu-panel" className={`${menuAbierto ? "flex" : "hidden"} flex-1 flex-col gap-6 px-3 pb-5 md:flex md:px-4`}>
          <nav aria-label="Secciones del panel" className="flex flex-col gap-1">
            {SECCIONES.map((seccion) => {
              const activa = pathname === seccion.href;
              return (
                <Link
                  key={seccion.href}
                  href={seccion.href}
                  onClick={() => setMenuAbierto(false)}
                  aria-current={activa ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-xl px-3.5 text-[15px] transition ${
                    activa ? "bg-[#1E1B1A] font-semibold text-white" : "text-[#4A4441] hover:bg-[#EFEBE6]"
                  }`}
                >
                  {seccion.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col items-start gap-2 px-3.5 text-sm">
            {negocio && (
              <a href={urlWebDeReservas(negocio)} target="_blank" rel="noopener" className="text-[#3B3532] underline-offset-4 hover:underline">
                Ver mi web de reservas ↗
              </a>
            )}
            <button type="button" onClick={cerrarSesion} className="min-h-8 text-[#6B6461] hover:text-[#1E1B1A]">
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-7 md:px-10 md:py-9">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {seccionActual && (
            <h1 className="text-4xl leading-tight md:text-5xl" style={{ fontFamily: "var(--font-titulo)" }}>
              {seccionActual.label}
            </h1>
          )}

          {cargandoNegocio && <p className="text-sm text-[#6B6461]">Cargando tu negocio...</p>}
          {errorNegocio && <p className="text-sm text-red-700">{errorNegocio}</p>}

          {negocio &&
            (sinTarjeta ? (
              children(negocio, setNegocio)
            ) : (
              <div className="rounded-2xl border border-[#ECE6E0] bg-white p-5 md:p-6">{children(negocio, setNegocio)}</div>
            ))}
        </div>
      </main>
    </div>
  );
}
