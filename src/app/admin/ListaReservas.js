"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  generarProximosDias,
  generarHorariosInicio,
  filtrarHorariosLibres,
  horaFin,
} from "../../lib/horarios";

const ETIQUETAS_ESTADO = {
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

const formatearPrecio = (precio) => `$${Number(precio).toLocaleString("es-AR")}`;

export default function ListaReservas({ negocio }) {
  const [reservas, setReservas] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [recargar, setRecargar] = useState(0);

  // ---- Bloquear un horario manualmente ----
  const diasDisponibles = generarProximosDias(negocio.dias_atencion);
  const [profesionalId, setProfesionalId] = useState("");
  const [fechaBloqueo, setFechaBloqueo] = useState("");
  const [duracionBloqueo, setDuracionBloqueo] = useState("90");
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [horaBloqueo, setHoraBloqueo] = useState("");
  const [motivoBloqueo, setMotivoBloqueo] = useState("");
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);

      const [
        { data: reservasData, error: errorReservas },
        { data: profesionalesData },
      ] = await Promise.all([
        supabase
          .from("reservas")
          .select("*, servicios(nombre), profesionales(nombre), sucursales(nombre)")
          .eq("negocio_id", negocio.id)
          .order("fecha", { ascending: true })
          .order("hora", { ascending: true }),
        supabase
          .from("profesionales")
          .select("id, nombre")
          .eq("negocio_id", negocio.id)
          .order("nombre"),
      ]);

      setCargando(false);

      if (errorReservas) {
        console.error("Error cargando reservas:", errorReservas);
        return;
      }

      setReservas(reservasData || []);
      setProfesionales(profesionalesData || []);
    }

    cargarDatos();
  }, [negocio.id, recargar]);

  useEffect(() => {
    const duracion = Number(duracionBloqueo);

    if (!profesionalId || !fechaBloqueo || !duracion) {
      setHorariosDisponibles([]);
      return;
    }

    async function cargarHorariosLibres() {
      setCargandoHorarios(true);
      setHoraBloqueo("");

      const horariosInicioPosibles = generarHorariosInicio(
        negocio.horario_apertura,
        negocio.horario_cierre,
        duracion
      );

      const { data: ocupados, error } = await supabase
        .from("turnos_ocupados")
        .select("hora, duracion_minutos")
        .eq("negocio_id", negocio.id)
        .eq("profesional_id", profesionalId)
        .eq("fecha", fechaBloqueo);

      if (error) {
        console.error("Error cargando horarios ocupados:", error);
      }

      setHorariosDisponibles(filtrarHorariosLibres(horariosInicioPosibles, duracion, ocupados));
      setCargandoHorarios(false);
    }

    cargarHorariosLibres();
  }, [
    profesionalId,
    fechaBloqueo,
    duracionBloqueo,
    negocio.id,
    negocio.horario_apertura,
    negocio.horario_cierre,
  ]);

  function recargarDatos() {
    setRecargar((valor) => valor + 1);
  }

  async function bloquearHorario(e) {
    e.preventDefault();
    const duracion = Number(duracionBloqueo);

    if (!profesionalId || !fechaBloqueo || !horaBloqueo || !duracion) {
      window.alert("Elegí profesional, día, duración y horario.");
      return;
    }

    setBloqueando(true);
    const { error } = await supabase.from("reservas").insert({
      negocio_id: negocio.id,
      servicio_id: null,
      profesional_id: profesionalId,
      nombre_cliente: motivoBloqueo.trim() || "Bloqueo manual",
      fecha: fechaBloqueo,
      hora: horaBloqueo,
      duracion_minutos: duracion,
      estado: "confirmada",
      bloqueo_manual: true,
    });
    setBloqueando(false);

    if (error) {
      window.alert("No pudimos bloquear el horario. Probá de nuevo.");
      return;
    }

    setProfesionalId("");
    setFechaBloqueo("");
    setHoraBloqueo("");
    setMotivoBloqueo("");
    recargarDatos();
  }

  async function cancelarReserva(id) {
    const confirmar = window.confirm(
      "¿Cancelar este turno? El horario va a quedar disponible de nuevo."
    );
    if (!confirmar) return;

    const { error } = await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", id);

    if (error) {
      window.alert("No pudimos cancelar el turno. Probá de nuevo.");
      return;
    }

    recargarDatos();
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-medium">Reservas</h2>

        {cargando ? (
          <p className="text-sm text-gray-500">Cargando reservas...</p>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no tenés reservas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reservas.map((reserva) => (
              <div key={reserva.id} className="rounded-lg border px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {reserva.bloqueo_manual ? `Bloqueado: ${reserva.nombre_cliente}` : reserva.nombre_cliente}
                  </span>
                  <span className="text-sm text-gray-500">
                    {ETIQUETAS_ESTADO[reserva.estado] || reserva.estado}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {reserva.servicios?.nombre}
                  {reserva.profesionales?.nombre ? ` con ${reserva.profesionales.nombre}` : ""}
                  {reserva.sucursales?.nombre ? ` — ${reserva.sucursales.nombre}` : ""}
                </p>
                <p className="text-sm text-gray-600">
                  {reserva.fecha} de {reserva.hora?.slice(0, 5)}
                  {reserva.duracion_minutos
                    ? ` a ${horaFin(reserva.hora?.slice(0, 5), reserva.duracion_minutos)}`
                    : ""}
                </p>
                {!reserva.bloqueo_manual && (
                  <>
                    <p className="text-sm text-gray-600">
                      Tel: {reserva.telefono_cliente || "-"}
                      {reserva.email_cliente ? ` · ${reserva.email_cliente}` : ""}
                    </p>
                    <p className="text-sm font-medium">Seña: {formatearPrecio(reserva.monto_sena || 0)}</p>
                  </>
                )}
                {reserva.estado !== "cancelada" && (
                  <button
                    onClick={() => cancelarReserva(reserva.id)}
                    className="mt-2 text-sm text-red-600 hover:underline"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Bloquear un horario</h2>
        <p className="text-sm text-gray-500 mb-3">
          Usalo cuando ocupaste un turno por otro medio (WhatsApp, en el local, etc.) y
          querés que deje de aparecer disponible para reservar online.
        </p>

        <form onSubmit={bloquearHorario} className="space-y-3 border rounded p-3 max-w-md">
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

          <select
            value={fechaBloqueo}
            onChange={(e) => setFechaBloqueo(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            disabled={!profesionalId}
          >
            <option value="">Elegí día</option>
            {diasDisponibles.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.etiqueta}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Duración (minutos)"
            value={duracionBloqueo}
            onChange={(e) => setDuracionBloqueo(e.target.value)}
            min="1"
            className="border rounded px-3 py-2 w-full"
          />

          <select
            value={horaBloqueo}
            onChange={(e) => setHoraBloqueo(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            disabled={!profesionalId || !fechaBloqueo || cargandoHorarios}
          >
            <option value="">
              {cargandoHorarios ? "Buscando horarios..." : "Elegí horario"}
            </option>
            {horariosDisponibles.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Motivo (opcional, ej: reservado por Instagram)"
            value={motivoBloqueo}
            onChange={(e) => setMotivoBloqueo(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />

          <button
            type="submit"
            disabled={bloqueando}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {bloqueando ? "Bloqueando..." : "Bloquear horario"}
          </button>
        </form>
      </section>
    </div>
  );
}
