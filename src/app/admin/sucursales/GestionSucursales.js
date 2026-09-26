"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function GestionSucursales({ negocio }) {
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recargar, setRecargar] = useState(0);

  const [nuevaSucursal, setNuevaSucursal] = useState({ nombre: "", direccion: "" });
  const [guardandoSucursal, setGuardandoSucursal] = useState(false);

  const [edicionId, setEdicionId] = useState(null);
  const [edicionSucursal, setEdicionSucursal] = useState({ nombre: "", direccion: "" });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setError("");

      const { data, error: errorSucursales } = await supabase
        .from("sucursales")
        .select("id, nombre, direccion")
        .eq("negocio_id", negocio.id)
        .order("nombre");

      if (errorSucursales) {
        setError("No pudimos cargar las sucursales. Probá recargar la página.");
        setCargando(false);
        return;
      }

      setSucursales(data || []);
      setCargando(false);
    }

    cargarDatos();
  }, [negocio.id, recargar]);

  function recargarDatos() {
    setRecargar((valor) => valor + 1);
  }

  async function agregarSucursal(e) {
    e.preventDefault();
    if (!nuevaSucursal.nombre.trim()) {
      window.alert("Ingresá al menos el nombre de la sucursal.");
      return;
    }

    setGuardandoSucursal(true);
    const { error: errorInsert } = await supabase.from("sucursales").insert({
      negocio_id: negocio.id,
      nombre: nuevaSucursal.nombre.trim(),
      direccion: nuevaSucursal.direccion.trim() || null,
    });
    setGuardandoSucursal(false);

    if (errorInsert) {
      window.alert("No pudimos guardar la sucursal. Probá de nuevo.");
      return;
    }

    setNuevaSucursal({ nombre: "", direccion: "" });
    recargarDatos();
  }

  function comenzarEdicion(sucursal) {
    setEdicionId(sucursal.id);
    setEdicionSucursal({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion || "",
    });
  }

  function cancelarEdicion() {
    setEdicionId(null);
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    if (!edicionSucursal.nombre.trim()) {
      window.alert("Ingresá al menos el nombre de la sucursal.");
      return;
    }

    setGuardandoEdicion(true);
    const { error: errorUpdate } = await supabase
      .from("sucursales")
      .update({
        nombre: edicionSucursal.nombre.trim(),
        direccion: edicionSucursal.direccion.trim() || null,
      })
      .eq("id", edicionId);
    setGuardandoEdicion(false);

    if (errorUpdate) {
      window.alert("No pudimos guardar los cambios. Probá de nuevo.");
      return;
    }

    setEdicionId(null);
    recargarDatos();
  }

  async function eliminarSucursal(id) {
    const confirmar = window.confirm(
      "¿Seguro que querés eliminar esta sucursal? Los profesionales y reservas que la tenían asignada quedan sin sucursal."
    );
    if (!confirmar) return;

    const { error: errorDelete } = await supabase.from("sucursales").delete().eq("id", id);

    if (errorDelete) {
      window.alert("No pudimos eliminar la sucursal. Probá de nuevo.");
      return;
    }

    recargarDatos();
  }

  if (cargando) {
    return <p className="text-sm text-gray-500">Cargando...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sucursales</h2>
        <p className="text-sm text-gray-500 mb-3">
          {sucursales.length <= 1
            ? "Con una sola sucursal (o ninguna), tus clientes no ven el paso de elegir sucursal al reservar. En cuanto cargues una segunda, ese paso aparece automáticamente."
            : "Tus clientes van a tener que elegir sucursal al reservar."}
        </p>

        <ul className="mb-4 space-y-2">
          {sucursales.length === 0 && (
            <li className="text-gray-500 text-sm">Todavía no hay sucursales cargadas.</li>
          )}
          {sucursales.map((s) => (
            <li key={s.id} className="border border-violet-100 bg-white rounded-xl px-3 py-3 shadow-sm shadow-violet-100/40">
              {edicionId === s.id ? (
                <form onSubmit={guardarEdicion} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={edicionSucursal.nombre}
                    onChange={(e) =>
                      setEdicionSucursal({ ...edicionSucursal, nombre: e.target.value })
                    }
                    className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
                  />
                  <input
                    type="text"
                    placeholder="Dirección (opcional)"
                    value={edicionSucursal.direccion}
                    onChange={(e) =>
                      setEdicionSucursal({ ...edicionSucursal, direccion: e.target.value })
                    }
                    className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
                  />
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={guardandoEdicion}
                      className="bg-violet-600 text-white rounded-full px-4 py-2 text-sm shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
                    >
                      {guardandoEdicion ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelarEdicion}
                      className="text-sm text-gray-500 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.nombre}</p>
                    {s.direccion && <p className="text-sm text-gray-500">{s.direccion}</p>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => comenzarEdicion(s)} className="text-sm hover:underline">
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarSucursal(s.id)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={agregarSucursal} className="space-y-2 border border-violet-100 bg-white rounded-xl p-3 shadow-sm shadow-violet-100/40">
          <p className="font-medium text-sm mb-1">Agregar sucursal nueva</p>
          <input
            type="text"
            placeholder="Nombre (ej: Sucursal Centro)"
            value={nuevaSucursal.nombre}
            onChange={(e) => setNuevaSucursal({ ...nuevaSucursal, nombre: e.target.value })}
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
          />
          <input
            type="text"
            placeholder="Dirección (opcional)"
            value={nuevaSucursal.direccion}
            onChange={(e) => setNuevaSucursal({ ...nuevaSucursal, direccion: e.target.value })}
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
          />
          <button
            type="submit"
            disabled={guardandoSucursal}
            className="bg-violet-600 text-white rounded-full px-5 py-2.5 shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
          >
            {guardandoSucursal ? "Guardando..." : "Agregar sucursal"}
          </button>
        </form>
      </section>
    </div>
  );
}
