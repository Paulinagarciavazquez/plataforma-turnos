"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNegocioAutenticado } from "../../lib/useNegocioAutenticado";

// Secciones del panel, en el orden en que aparecen en la navegación.
const SECCIONES = [
  { href: "/admin", label: "Reservas" },
  { href: "/admin/servicios", label: "Servicios y profesionales" },
  { href: "/admin/sucursales", label: "Sucursales" },
  { href: "/admin/ausencias", label: "Ausencias" },
  { href: "/admin/configuracion", label: "Configuración" },
];

// Layout compartido por todas las pantallas del panel: pantalla de login si
// no hay sesión, encabezado + navegación + estado de carga/error del
// negocio, y el contenido propio de cada pantalla (vía render prop, recibe
// el negocio ya cargado) una vez que todo está listo.
export default function AdminShell({ children }) {
  const {
    cargandoSesion,
    sesion,
    negocio,
    setNegocio,
    cargandoNegocio,
    errorNegocio,
    cerrarSesion,
  } = useNegocioAutenticado();

  const pathname = usePathname();

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

  if (cargandoSesion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F4FC]">
        <p className="text-gray-500">Cargando...</p>
      </main>
    );
  }

  if (!sesion) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F6F4FC] px-6">
        <h1 className="text-2xl font-semibold text-gray-900">Panel del negocio</h1>
        <form
          onSubmit={manejarLogin}
          className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm shadow-violet-100/40"
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-violet-200 bg-white px-4 py-3 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-violet-200 bg-white px-4 py-3 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition"
            required
          />
          {errorLogin && <p className="text-sm text-red-600">{errorLogin}</p>}
          <button
            type="submit"
            disabled={enviandoLogin}
            className="rounded-full bg-violet-600 px-8 py-3 text-white font-medium shadow-sm hover:bg-violet-700 transition disabled:opacity-60"
          >
            {enviandoLogin ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F4FC] px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            {negocio ? negocio.nombre : "Panel del negocio"}
          </h1>
          <button
            onClick={cerrarSesion}
            className="rounded-full border border-violet-200 px-4 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition"
          >
            Cerrar sesión
          </button>
        </div>

        <nav className="flex flex-wrap gap-2">
          {SECCIONES.map((seccion) => {
            const activa = pathname === seccion.href;
            return (
              <Link
                key={seccion.href}
                href={seccion.href}
                className={
                  activa
                    ? "rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm"
                    : "rounded-full px-4 py-1.5 text-sm text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition"
                }
              >
                {seccion.label}
              </Link>
            );
          })}
        </nav>

        {cargandoNegocio && <p className="text-sm text-gray-500">Cargando tu negocio...</p>}
        {errorNegocio && <p className="text-sm text-red-600">{errorNegocio}</p>}

        {negocio && (
          <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm shadow-violet-100/40">
            {children(negocio, setNegocio)}
          </div>
        )}
      </div>
    </main>
  );
}
