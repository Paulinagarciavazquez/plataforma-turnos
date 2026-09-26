"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  generarProximosDias,
  generarHorariosInicio,
  filtrarHorariosLibres,
  horaFin,
  aIso,
} from "../../lib/horarios";

const ETIQUETAS_ESTADO = {
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

const formatearPrecio = (precio) => `$${Number(precio).toLocaleString("es-AR")}`;

const NOMBRES_DIA_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Encabezado bien legible para la vista de agenda por día, ej: "Lunes 28 de septiembre".
function formatearFechaLarga(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${NOMBRES_DIA_LARGO[fecha.getDay()]} ${d} de ${NOMBRES_MES[m - 1]}`;
}

function sumarDias(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + delta);
  return aIso(fecha);
}

export default function ListaReservas({ negocio }) {
  const [reservas, setReservas] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [recargar, setRecargar] = useState(0);

  // Vista de agenda: qué día se está mostrando en la sección "Reservas" de
  // más abajo. Arranca en hoy; navegar no vuelve a pedir datos al servidor,
  // solo filtra "reservas" (que ya tiene todo cargado) por fecha.
  const [fechaAgenda, setFechaAgenda] = useState(() => aIso(new Date()));

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

  const hoyIso = aIso(new Date());
  const reservasDelDia = reservas.filter((reserva) => reserva.fecha === fechaAgenda);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Reservas</h2>

        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFechaAgenda((f) => sumarDias(f, -1))}
            className="rounded-full border border-violet-200 px-4 py-1.5 text-sm text-violet-700 hover:bg-violet-50 transition"
          >
            ← Anterior
          </button>

          <div className="text-center">
            <p className="font-medium">{formatearFechaLarga(fechaAgenda)}</p>
            {fechaAgenda !== hoyIso && (
              <button
                type="button"
                onClick={() => setFechaAgenda(hoyIso)}
                className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700"
              >
                Volver a hoy
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFechaAgenda((f) => sumarDias(f, 1))}
            className="rounded-full border border-violet-200 px-4 py-1.5 text-sm text-violet-700 hover:bg-violet-50 transition"
          >
            Siguiente →
          </button>
        </div>

        {cargando ? (
          <p className="text-sm text-gray-500">Cargando reservas...</p>
        ) : reservasDelDia.length === 0 ? (
          <p className="text-sm text-gray-500">No hay turnos para este día.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-500">
              {reservasDelDia.length} {reservasDelDia.length === 1 ? "turno" : "turnos"}
            </p>
            <div className="flex flex-col gap-3">
              {reservasDelDia.map((reserva) => (
                <div key={reserva.id} className="rounded-xl border border-violet-100 bg-white px-4 py-3 shadow-sm shadow-violet-100/40">
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
                    {reserva.hora?.slice(0, 5)}
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
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Bloquear un horario</h2>
        <p className="text-sm text-gray-500 mb-3">
          Usalo cuando ocupaste un turno por otro medio (WhatsApp, en el local, etc.) y
          querés que deje de aparecer disponible para reservar online.
        </p>

        <form onSubmit={bloquearHorario} className="space-y-3 border border-violet-100 bg-white rounded-xl p-3 shadow-sm shadow-violet-100/40 max-w-md">
          <select
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
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
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
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
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
          />

          <select
            value={horaBloqueo}
            onChange={(e) => setHoraBloqueo(e.target.value)}
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
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
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
          />

          <button
            type="submit"
            disabled={bloqueando}
            className="bg-violet-600 text-white rounded-full px-5 py-2.5 shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
          >
            {bloqueando ? "Bloqueando..." : "Bloquear horario"}
          </button>
        </form>
      </section>
    </div>
  );
}
