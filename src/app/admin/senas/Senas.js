"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { aIso } from "../../../lib/horarios";
import { reservaSinPagarVencida } from "../../../lib/reservas";

// Señas (paso 3 del rediseño del panel): cuánto se cobró en señas en el mes
// o la semana que se mira (según la fecha del turno, igual que la Agenda),
// y el estado de cada seña. La plata en sí está en la cuenta de Mercado Pago
// del negocio; esto es un resumen para tenerla a mano.

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function aFecha(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sumarDias(iso, n) {
  const f = aFecha(iso);
  f.setDate(f.getDate() + n);
  return aIso(f);
}
function lunesDe(iso) {
  return sumarDias(iso, -((aFecha(iso).getDay() + 6) % 7));
}
function plata(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}
function textoTurno(r) {
  const f = aFecha(r.fecha);
  return `${DIAS_CORTO[f.getDay()]} ${f.getDate()}/${f.getMonth() + 1} · ${r.hora.slice(0, 5)}`;
}

// Estado de la seña de cada reserva (los bloqueos manuales no tienen seña).
function estadoSena(r) {
  if (r.estado === "cancelada") return r.id_pago_mercadopago ? "cancelada_pagada" : null;
  if (r.estado === "confirmada") return "pagada";
  if (reservaSinPagarVencida(r)) return "sin_pagar";
  return "esperando";
}

const ESTADOS = {
  pagada: { texto: "Pagada", estilo: { backgroundColor: "#E3F1E7", color: "#1E5B33" } },
  esperando: { texto: "Esperando pago", estilo: { backgroundColor: "#FBF0DC", color: "#7A4A0C" } },
  sin_pagar: { texto: "Sin pagar · horario liberado", estilo: { backgroundColor: "#EFEBE6", color: "#5B5451" } },
  cancelada_pagada: { texto: "Cancelado · seña cobrada", estilo: { backgroundColor: "#F7E3E3", color: "#8A1F23" } },
};

const FILTROS = [
  ["todas", "Todas"],
  ["pagada", "Pagadas"],
  ["sin_pagar", "Sin pagar"],
  ["cancelada_pagada", "Canceladas"],
];

function descargarPlanilla(filas, nombreArchivo) {
  const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lineas = [
    ["Fecha del turno", "Hora", "Cliente", "Teléfono", "Email", "Servicio", "Profesional", "Seña", "Estado", "Id de pago"],
    ...filas.map((r) => [
      r.fecha,
      r.hora.slice(0, 5),
      r.nombre_cliente,
      r.telefono_cliente,
      r.email_cliente,
      r.servicios?.nombre,
      r.profesionales?.nombre,
      Number(r.monto_sena || 0),
      ESTADOS[r.estadoSena].texto,
      r.id_pago_mercadopago,
    ]),
  ].map((fila) => fila.map(celda).join(";"));
  // BOM para que Excel abra bien los acentos; ";" porque es el separador
  // que usa Excel en español.
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Senas({ negocio }) {
  const hoy = aIso(new Date());
  const [periodo, setPeriodo] = useState("mes");
  const [fechaRef, setFechaRef] = useState(hoy);
  const [filtro, setFiltro] = useState("todas");
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  let desde;
  let hasta;
  let titulo;
  const fRef = aFecha(fechaRef);
  if (periodo === "mes") {
    desde = aIso(new Date(fRef.getFullYear(), fRef.getMonth(), 1));
    hasta = aIso(new Date(fRef.getFullYear(), fRef.getMonth() + 1, 0));
    titulo = `${MESES[fRef.getMonth()][0].toUpperCase()}${MESES[fRef.getMonth()].slice(1)} ${fRef.getFullYear()}`;
  } else {
    desde = lunesDe(fechaRef);
    hasta = sumarDias(desde, 6);
    const ini = aFecha(desde);
    const fin = aFecha(hasta);
    titulo =
      ini.getMonth() === fin.getMonth()
        ? `Semana del ${ini.getDate()} al ${fin.getDate()} de ${MESES[fin.getMonth()]}`
        : `Semana del ${ini.getDate()} de ${MESES[ini.getMonth()]} al ${fin.getDate()} de ${MESES[fin.getMonth()]}`;
  }

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setErrorCarga(null);
      const { data, error } = await supabase
        .from("reservas")
        .select("*, servicios(nombre), profesionales(nombre)")
        .eq("negocio_id", negocio.id)
        .eq("bloqueo_manual", false)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true });
      setCargando(false);
      if (error) {
        console.error("Error cargando señas:", error);
        setErrorCarga("No pudimos cargar las señas. Probá recargar la página.");
        return;
      }
      setReservas(data || []);
    }
    cargar();
  }, [negocio.id, desde, hasta]);

  const conEstado = reservas.map((r) => ({ ...r, estadoSena: estadoSena(r) })).filter((r) => r.estadoSena);
  const pagadas = conEstado.filter((r) => r.estadoSena === "pagada");
  const sinPagar = conEstado.filter((r) => r.estadoSena === "sin_pagar");
  const canceladasPagadas = conEstado.filter((r) => r.estadoSena === "cancelada_pagada");
  const cobrado = [...pagadas, ...canceladasPagadas].reduce((s, r) => s + Number(r.monto_sena || 0), 0);
  const lista = filtro === "todas" ? conEstado : conEstado.filter((r) => r.estadoSena === filtro);
  const hayDemo = conEstado.some((r) => r.id_pago_mercadopago === "demo");

  function mover(sentido) {
    if (periodo === "mes") setFechaRef(aIso(new Date(fRef.getFullYear(), fRef.getMonth() + sentido, 1)));
    else setFechaRef(sumarDias(fechaRef, 7 * sentido));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-3xl leading-tight md:text-4xl" style={{ fontFamily: "var(--font-titulo)" }}>
          {titulo}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className="h-11 w-11 rounded-full border border-[#DCD5CE] bg-white">
            ←
          </button>
          <button type="button" onClick={() => setFechaRef(hoy)} className="min-h-11 rounded-full border border-[#DCD5CE] bg-white px-4">
            Hoy
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className="h-11 w-11 rounded-full border border-[#DCD5CE] bg-white">
            →
          </button>
          <div className="ml-1 flex gap-1 rounded-full bg-[#EFEBE6] p-1" role="group" aria-label="Período">
            {[
              ["semana", "Semana"],
              ["mes", "Mes"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={periodo === id}
                onClick={() => setPeriodo(id)}
                className={`min-h-9 rounded-full px-4 text-sm ${periodo === id ? "bg-[#1E1B1A] font-semibold text-white" : "text-[#3B3532]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#1E1B1A] p-5 text-white">
          <p className="text-sm text-[#D9D3CE]">Cobrado en señas</p>
          <p className="text-5xl leading-tight" style={{ fontFamily: "var(--font-titulo)" }}>
            {plata(cobrado)}
          </p>
          {canceladasPagadas.length > 0 && (
            <p className="text-[13px] text-[#D9D3CE]">
              Incluye {canceladasPagadas.length} {canceladasPagadas.length === 1 ? "seña" : "señas"} de turnos cancelados
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#ECE6E0] bg-white p-5">
          <p className="text-sm text-[#6B6461]">Turnos con seña pagada</p>
          <p className="text-4xl leading-tight" style={{ fontFamily: "var(--font-titulo)" }}>
            {pagadas.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#ECE6E0] bg-white p-5">
          <p className="text-sm text-[#6B6461]">Reservas sin pagar</p>
          <p className="text-4xl leading-tight" style={{ fontFamily: "var(--font-titulo)" }}>
            {sinPagar.length}
          </p>
          <p className="text-[13px] text-[#6B6461]">El horario se libera solo a los 30 minutos</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar señas">
          {FILTROS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`min-h-10 rounded-full border px-4 text-sm ${
                filtro === id ? "border-[#1E1B1A] bg-[#1E1B1A] font-semibold text-white" : "border-[#E1DBD5] bg-white text-[#3B3532]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={lista.length === 0}
          onClick={() => descargarPlanilla(lista, `senas-${negocio.slug}-${desde}-al-${hasta}.csv`)}
          className="min-h-10 rounded-full border border-[#DCD5CE] bg-white px-4 text-sm disabled:opacity-40"
        >
          Descargar planilla
        </button>
      </div>

      <div className="rounded-2xl border border-[#ECE6E0] bg-white">
        {cargando ? (
          <p className="p-6 text-[#6B6461]">Cargando señas...</p>
        ) : errorCarga ? (
          <p className="p-6 text-red-700">{errorCarga}</p>
        ) : lista.length === 0 ? (
          <p className="p-6 text-[#6B6461]">No hay señas para mostrar en este período.</p>
        ) : (
          <ul>
            {lista.map((r, i) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 ${i > 0 ? "border-t border-[#EFEAE5]" : ""}`}
              >
                <span className="w-32 shrink-0 text-sm tabular-nums text-[#3B3532]">{textoTurno(r)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.nombre_cliente}</span>
                  <span className="block truncate text-sm text-[#6B6461]">
                    {[r.servicios?.nombre, r.profesionales?.nombre].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="w-24 text-right tabular-nums">{plata(r.monto_sena)}</span>
                <span className="rounded-full px-3 py-1 text-[13px]" style={ESTADOS[r.estadoSena].estilo}>
                  {r.id_pago_mercadopago === "demo" && r.estadoSena === "pagada" ? "Pagada (demo)" : ESTADOS[r.estadoSena].texto}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="-mt-3 text-[13px] text-[#6B6461]">
        La plata de las señas entra directo en tu cuenta de{" "}
        <a href="https://www.mercadopago.com.ar/activities" target="_blank" rel="noopener" className="underline underline-offset-2">
          Mercado Pago
        </a>
        ; ahí ves cada cobro y podés hacer devoluciones.
        {hayDemo && " Las señas marcadas como “demo” se simularon y no son plata real."}
      </p>
    </div>
  );
}
