"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function hoyIso() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function GestionAusencias({ negocio }) {
  const [profesionales, setProfesionales] = useState([]);
  const [ausencias, setAusencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recargar, setRecargar] = useState(0);

  const [profesionalId, setProfesionalId] = useState("");
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setError("");

      const [
        { data: profesionalesData, error: errorProfesionales },
        { data: ausenciasData, error: errorAusencias },
      ] = await Promise.all([
        supabase
          .from("profesionales")
          .select("id, nombre")
          .eq("negocio_id", negocio.id)
          .order("nombre"),
        supabase
          .from("ausencias_profesionales")
          .select("id, fecha, motivo, profesional_id, profesionales(nombre)")
          .eq("negocio_id", negocio.id)
          .order("fecha"),
      ]);

      if (errorProfesionales || errorAusencias) {
        setError("No pudimos cargar los datos. Probá recargar la página.");
        setCargando(false);
        return;
      }

      setProfesionales(profesionalesData || []);
      setAusencias(ausenciasData || []);
      setCargando(false);
    }

    cargarDatos();
  }, [negocio.id, recargar]);

  function recargarDatos() {
    setRecargar((valor) => valor + 1);
  }

  async function agregarAusencia(e) {
    e.preventDefault();

    if (!profesionalId || !fecha) {
      window.alert("Elegí profesional y día.");
      return;
    }

    setGuardando(true);
    const { error: errorInsert } = await supabase.from("ausencias_profesionales").insert({
      negocio_id: negocio.id,
      profesional_id: profesionalId,
      fecha,
      motivo: motivo.trim() || null,
    });
    setGuardando(false);

    if (errorInsert) {
      if (errorInsert.code === "23505") {
        window.alert("Ese profesional ya tiene una ausencia cargada para ese día.");
      } else {
        window.alert("No pudimos guardar la ausencia. Probá de nuevo.");
      }
      return;
    }

    setProfesionalId("");
    setFecha("");
    setMotivo("");
    recargarDatos();
  }

  async function eliminarAusencia(id) {
    const confirmar = window.confirm("¿Eliminar esta ausencia? Ese día vuelve a estar disponible.");
    if (!confirmar) return;

    const { error: errorDelete } = await supabase
      .from("ausencias_profesionales")
      .delete()
      .eq("id", id);

    if (errorDelete) {
      window.alert("No pudimos eliminar la ausencia. Probá de nuevo.");
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
    <div className="space-y-8 max-w-lg">
      <section>
        <h2 className="text-lg font-semibold mb-3">Ausencias cargadas</h2>

        {ausencias.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">
            No hay ausencias cargadas. Usalas cuando un profesional no pueda trabajar un día
            puntual (vacaciones, licencia, etc.) — ese día va a dejar de aparecer disponible
            para reservar con esa persona.
          </p>
        ) : (
          <ul className="mb-4 space-y-1">
            {ausencias.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between border rounded px-3 py-2"
              >
                <span className="text-sm">
                  {a.profesionales?.nombre} — {a.fecha}
                  {a.motivo ? ` (${a.motivo})` : ""}
                </span>
                <button
                  onClick={() => eliminarAusencia(a.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={agregarAusencia} className="space-y-2 border rounded p-3">
          <p className="font-medium text-sm mb-1">Cargar ausencia nueva</p>

          <select
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="">Elegí profesional</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <input
            type="date"
            min={hoyIso()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />

          <input
            type="text"
            placeholder="Motivo (opcional, ej: vacaciones)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />

          <button
            type="submit"
            disabled={guardando}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Cargar ausencia"}
          </button>
        </form>
      </section>
    </div>
  );
}
