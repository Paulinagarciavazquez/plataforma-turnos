"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNegocioAutenticado } from "../../lib/useNegocioAutenticado";

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
      <main className="flex min-h-screen items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!sesion) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Panel del negocio</h1>
        <form onSubmit={manejarLogin} className="flex w-full max-w-sm flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border px-4 py-3"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border px-4 py-3"
            required
          />
          {errorLogin && <p className="text-sm text-red-600">{errorLogin}</p>}
          <button
            type="submit"
            disabled={enviandoLogin}
            className="rounded-full bg-black px-8 py-3 text-white font-medium disabled:opacity-60"
          >
            {enviandoLogin ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{negocio ? negocio.nombre : "Panel del negocio"}</h1>
          <button onClick={cerrarSesion} className="text-sm text-gray-500 underline">
            Cerrar sesión
          </button>
        </div>

        <nav className="flex gap-4 border-b pb-2 text-sm">
          <Link href="/admin" className="hover:underline">
            Reservas
          </Link>
          <Link href="/admin/servicios" className="hover:underline">
            Servicios y profesionales
          </Link>
          <Link href="/admin/sucursales" className="hover:underline">
            Sucursales
          </Link>
          <Link href="/admin/ausencias" className="hover:underline">
            Ausencias
          </Link>
          <Link href="/admin/configuracion" className="hover:underline">
            Configuración
          </Link>
        </nav>

        {cargandoNegocio && <p className="text-sm text-gray-500">Cargando tu negocio...</p>}
        {errorNegocio && <p className="text-sm text-red-600">{errorNegocio}</p>}

        {negocio && children(negocio, setNegocio)}
      </div>
    </main>
  );
}
