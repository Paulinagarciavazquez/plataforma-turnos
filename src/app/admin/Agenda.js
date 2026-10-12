"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { aIso, horaFin } from "../../lib/horarios";
import { reservaSinPagarVencida } from "../../lib/reservas";
import { colorDeMarca } from "../../lib/marcaNegocio";

// Agenda del panel (paso 2 del rediseño): calendario por Semana (cada día
// dividido por profesional), Día (una columna por profesional) y Mes, con un
// resumen arriba. Tocar un turno abre su ficha; tocar un horario libre
// permite bloquearlo. Toda la info sale de "reservas" (que la dueña puede
// leer completa por RLS) y se filtra en el momento, sin consultas extra al
// cambiar de vista.

const MINUTOS_CASILLERO = 30;
const ALTO_CASILLERO = 28; // px
const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ---- Fechas (siempre como "YYYY-MM-DD", en hora local) ----
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
  const f = aFecha(iso);
  const desdeLunes = (f.getDay() + 6) % 7;
  return sumarDias(iso, -desdeLunes);
}
function diaSemana(iso) {
  return aFecha(iso).getDay();
}
function textoDiaCorto(iso) {
  const f = aFecha(iso);
  return `${DIAS_CORTO[f.getDay()]} ${f.getDate()}`;
}
function textoDiaLargo(iso) {
  const f = aFecha(iso);
  return `${DIAS_LARGO[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}
function minutosDe(hora) {
  const [h, m] = (hora || "00:00").slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function horaDe(minutos) {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;
}
function plata(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

// Link de WhatsApp a partir del teléfono que cargó el cliente. wa.me pide el
// número internacional: si no empieza con 54, asumimos un celular argentino
// (54 9 + código de área + número).
function linkWhatsApp(telefono, texto) {
  let numero = String(telefono || "").replace(/\D/g, "");
  if (!numero) return null;
  if (numero.startsWith("0")) numero = numero.slice(1);
  if (!numero.startsWith("54")) numero = `549${numero}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// Estado con el que se dibuja cada reserva en la agenda.
function estadoVisual(reserva) {
  if (reserva.estado === "cancelada" || reservaSinPagarVencida(reserva)) return null;
  if (reserva.bloqueo_manual) return "bloqueo";
  if (reserva.estado === "pendiente_pago") return "pendiente";
  return "confirmada";
}

const ETIQUETA_ESTADO = {
  confirmada: "Seña pagada",
  pendiente: "Esperando pago",
  bloqueo: "Bloqueado",
};

const ESTILO_BLOQUEO = {
  backgroundImage: "repeating-linear-gradient(135deg, #ECE8E3 0 6px, #F5F2EE 6px 12px)",
  borderColor: "#DDD6CF",
};

function Pastilla({ activa, onClick, children, ...resto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`min-h-10 rounded-full border px-4 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        activa ? "border-[#1E1B1A] bg-[#1E1B1A] font-semibold text-white" : "border-[#E1DBD5] bg-white text-[#3B3532] hover:border-[#1E1B1A]"
      }`}
      {...resto}
    >
      {children}
    </button>
  );
}

function Ventana({ titulo, subtitulo, onCerrar, children }) {
  useEffect(() => {
    const alApretar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B1A]/40 p-0 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl leading-tight" style={{ fontFamily: "var(--font-titulo)" }}>
              {titulo}
            </h2>
            {subtitulo && <p className="mt-1 text-[15px] text-[#5B5451]">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DCD5CE] text-lg"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Agenda({ negocio }) {
  const color = colorDeMarca(negocio);
  const hoy = aIso(new Date());

  // En el celular arranca en la vista Día (la semana entera no entra).
  // Este componente se monta recién con la sesión cargada (nunca en el
  // servidor), así que se puede mirar el ancho de la pantalla acá.
  const [vista, setVista] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "dia" : "semana"
  );
  const [fechaRef, setFechaRef] = useState(hoy);
  const [filtroProf, setFiltroProf] = useState("todas");

  const [reservas, setReservas] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [recargar, setRecargar] = useState(0);

  const [seleccion, setSeleccion] = useState(null); // reserva abierta en la ficha
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [hueco, setHueco] = useState(null); // { fecha, minutos, profesionalId }
  const [duracionBloqueo, setDuracionBloqueo] = useState(60);
  const [motivoBloqueo, setMotivoBloqueo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      setErrorCarga(null);

      const [{ data: reservasData, error: errorReservas }, { data: profesionalesData }] = await Promise.all([
        supabase
          .from("reservas")
          .select("*, servicios(nombre), profesionales(nombre), sucursales(nombre)")
          .eq("negocio_id", negocio.id)
          .neq("estado", "cancelada")
          .order("fecha", { ascending: true })
          .order("hora", { ascending: true }),
        supabase
          .from("profesionales")
          .select("id, nombre, sucursales(nombre)")
          .eq("negocio_id", negocio.id)
          .order("nombre"),
      ]);

      setCargando(false);

      if (errorReservas) {
        console.error("Error cargando reservas:", errorReservas);
        setErrorCarga("No pudimos cargar la agenda. Probá recargar la página.");
        return;
      }

      setReservas(reservasData || []);
      // Si dos profesionales se llaman igual (ej. una "Martina" por
      // sucursal), les sumamos la sucursal al nombre para distinguirlas.
      const lista = profesionalesData || [];
      const repetidos = lista.filter((p) => lista.filter((q) => q.nombre === p.nombre).length > 1);
      setProfesionales(
        lista.map((p) => ({
          ...p,
          nombre: repetidos.includes(p) && p.sucursales?.nombre ? `${p.nombre} · ${p.sucursales.nombre}` : p.nombre,
        }))
      );
    }

    cargarDatos();
  }, [negocio.id, recargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  // ---- Qué se muestra ----
  const apertura = minutosDe(negocio.horario_apertura || "09:00");
  const cierre = Math.max(minutosDe(negocio.horario_cierre || "18:00"), apertura + MINUTOS_CASILLERO);
  const casilleros = Math.ceil((cierre - apertura) / MINUTOS_CASILLERO);
  const diasAtencion = negocio.dias_atencion?.length ? negocio.dias_atencion : [0, 1, 2, 3, 4, 5, 6];

  const lunes = lunesDe(fechaRef);
  const diasSemana = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)).filter((iso) =>
    diasAtencion.includes(diaSemana(iso))
  );
  const diasVista = vista === "dia" ? [fechaRef] : diasSemana;

  const visibles = reservas
    .map((r) => ({ ...r, visual: estadoVisual(r) }))
    .filter((r) => r.visual);

  const sinProfesional = visibles.some((r) => !r.profesional_id && diasVista.includes(r.fecha));
  const carriles =
    filtroProf === "todas"
      ? [...profesionales, ...(sinProfesional ? [{ id: null, nombre: "Sin asignar" }] : [])]
      : profesionales.filter((p) => p.id === filtroProf);
  const L = Math.max(carriles.length, 1);
  const filasCabecera = L > 1 ? 2 : 1;
  const anchoMinimo = vista === "dia" ? 110 : L > 1 ? 76 : 120;

  // ---- Rango del resumen: el día, la semana o el mes que se está mirando ----
  let desde = fechaRef;
  let hasta = fechaRef;
  if (vista === "semana") {
    desde = lunes;
    hasta = sumarDias(lunes, 6);
  } else if (vista === "mes") {
    const f = aFecha(fechaRef);
    desde = aIso(new Date(f.getFullYear(), f.getMonth(), 1));
    hasta = aIso(new Date(f.getFullYear(), f.getMonth() + 1, 0));
  }
  const turnosRango = visibles.filter((r) => r.visual !== "bloqueo" && r.fecha >= desde && r.fecha <= hasta);
  const pagadosRango = turnosRango.filter((r) => r.visual === "confirmada");
  const senasRango = pagadosRango.reduce((suma, r) => suma + Number(r.monto_sena || 0), 0);
  const ahora = new Date();
  const ahoraIso = aIso(ahora);
  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes();
  const proximo = visibles.find(
    (r) =>
      r.visual === "confirmada" &&
      (r.fecha > ahoraIso || (r.fecha === ahoraIso && minutosDe(r.hora) >= ahoraMinutos))
  );
  const nombreRango = vista === "dia" ? "del día" : vista === "semana" ? "de la semana" : "del mes";

  // ---- Títulos y navegación ----
  const fRef = aFecha(fechaRef);
  const mesYAnio = `${MESES[fRef.getMonth()][0].toUpperCase()}${MESES[fRef.getMonth()].slice(1)} ${fRef.getFullYear()}`;
  let titulo = mesYAnio;
  if (vista === "dia") titulo = textoDiaLargo(fechaRef);
  if (vista === "semana") {
    const fin = aFecha(sumarDias(lunes, 6));
    const ini = aFecha(lunes);
    titulo =
      ini.getMonth() === fin.getMonth()
        ? `Semana del ${ini.getDate()} al ${fin.getDate()} de ${MESES[fin.getMonth()]}`
        : `Semana del ${ini.getDate()} de ${MESES[ini.getMonth()]} al ${fin.getDate()} de ${MESES[fin.getMonth()]}`;
  }

  function mover(sentido) {
    if (vista === "dia") setFechaRef((f) => sumarDias(f, sentido));
    else if (vista === "semana") setFechaRef((f) => sumarDias(f, 7 * sentido));
    else setFechaRef((f) => aIso(new Date(aFecha(f).getFullYear(), aFecha(f).getMonth() + sentido, 1)));
  }

  // ---- Acciones ----
  function abrirHueco(fecha, minutos, profesionalId) {
    // Arranca con 1 h si entra en el hueco; si no, 30 min.
    const entraUnaHora = minutos + 60 <= cierre && !seSuperpone(fecha, minutos, 60, profesionalId);
    setHueco({ fecha, minutos, profesionalId });
    setDuracionBloqueo(entraUnaHora ? 60 : 30);
    setMotivoBloqueo("");
  }

  // ¿Ese bloque se superpone con algo ya ocupado de esa profesional?
  function seSuperpone(fecha, inicio, duracion, profesionalId) {
    return visibles.some((r) => {
      if (r.fecha !== fecha || (r.profesional_id ?? null) !== (profesionalId ?? null)) return false;
      const ri = minutosDe(r.hora);
      return inicio < ri + r.duracion_minutos && ri < inicio + duracion;
    });
  }

  async function bloquear() {
    if (!hueco) return;
    setGuardando(true);
    const { error } = await supabase.from("reservas").insert({
      negocio_id: negocio.id,
      servicio_id: null,
      profesional_id: hueco.profesionalId,
      nombre_cliente: motivoBloqueo.trim() || "Bloqueo manual",
      fecha: hueco.fecha,
      hora: horaDe(hueco.minutos),
      duracion_minutos: duracionBloqueo,
      estado: "confirmada",
      bloqueo_manual: true,
    });
    setGuardando(false);

    if (error) {
      console.error("Error bloqueando horario:", error);
      setAviso("No pudimos bloquear el horario. Probá de nuevo.");
      return;
    }

    setHueco(null);
    setAviso("Horario bloqueado: ya no se ofrece online.");
    setRecargar((n) => n + 1);
  }

  async function cancelarSeleccion() {
    if (!seleccion) return;
    setGuardando(true);
    const { error } = await supabase.from("reservas").update({ estado: "cancelada" }).eq("id", seleccion.id);
    setGuardando(false);

    if (error) {
      console.error("Error cancelando:", error);
      setAviso("No pudimos cancelarlo. Probá de nuevo.");
      return;
    }

    setAviso(seleccion.bloqueo_manual ? "Bloqueo quitado." : "Turno cancelado: el horario vuelve a estar libre.");
    setSeleccion(null);
    setConfirmandoCancelar(false);
    setRecargar((n) => n + 1);
  }

  // ---- Grilla (Semana / Día) ----
  const columnas = `56px repeat(${diasVista.length * L}, minmax(${anchoMinimo}px, 1fr))`;
  const filas = `40px ${L > 1 ? "26px " : ""}repeat(${casilleros}, ${ALTO_CASILLERO}px)`;

  function columnaDe(indiceDia, indiceCarril) {
    return 2 + indiceDia * L + indiceCarril;
  }

  const eventos = [];
  visibles.forEach((r) => {
    const indiceDia = diasVista.indexOf(r.fecha);
    const indiceCarril = carriles.findIndex((p) => (p.id ?? null) === (r.profesional_id ?? null));
    if (indiceDia < 0 || indiceCarril < 0) return;
    const inicio = Math.max(0, Math.floor((minutosDe(r.hora) - apertura) / MINUTOS_CASILLERO));
    const largo = Math.max(1, Math.min(casilleros - inicio, Math.ceil(r.duracion_minutos / MINUTOS_CASILLERO)));
    if (inicio >= casilleros) return;
    eventos.push({ r, columna: columnaDe(indiceDia, indiceCarril), fila: filasCabecera + 1 + inicio, largo });
  });

  // ---- Mes ----
  const primeroDelMes = new Date(fRef.getFullYear(), fRef.getMonth(), 1);
  const diasDelMes = new Date(fRef.getFullYear(), fRef.getMonth() + 1, 0).getDate();
  const huecosAntes = (primeroDelMes.getDay() + 6) % 7;
  const celdasMes = [
    ...Array.from({ length: huecosAntes }, () => null),
    ...Array.from({ length: diasDelMes }, (_, i) => aIso(new Date(fRef.getFullYear(), fRef.getMonth(), i + 1))),
  ];

  return (
    <div className="flex flex-col gap-6">
      {aviso && (
        <div role="status" className="self-start rounded-full bg-[#1E1B1A] px-5 py-2.5 text-sm text-white">
          {aviso}
        </div>
      )}

      {/* Título + navegación */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {vista !== "mes" && <p className="text-xs uppercase tracking-[0.08em] text-[#6B6461]">{mesYAnio}</p>}
          <p className="mt-1 text-3xl leading-tight md:text-4xl" style={{ fontFamily: "var(--font-titulo)" }}>
            {titulo}
          </p>
        </div>
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
          <div className="ml-1 flex gap-1 rounded-full bg-[#EFEBE6] p-1" role="group" aria-label="Vista">
            {[
              ["dia", "Día"],
              ["semana", "Semana"],
              ["mes", "Mes"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={vista === id}
                onClick={() => setVista(id)}
                className={`min-h-9 rounded-full px-4 text-sm ${vista === id ? "bg-[#1E1B1A] font-semibold text-white" : "text-[#3B3532]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#1E1B1A] p-5 text-white">
          <p className="text-sm text-[#D9D3CE]">Turnos {nombreRango}</p>
          <p className="text-5xl leading-tight" style={{ fontFamily: "var(--font-titulo)" }}>
            {turnosRango.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#ECE6E0] bg-white p-5">
          <p className="text-sm text-[#6B6461]">Señas cobradas {nombreRango}</p>
          <p className="text-4xl leading-tight" style={{ fontFamily: "var(--font-titulo)" }}>
            {plata(senasRango)}
          </p>
          <p className="text-[13px] text-[#6B6461]">
            {pagadosRango.length} de {turnosRango.length} con seña pagada
          </p>
        </div>
        <div className="rounded-2xl border border-[#ECE6E0] bg-white p-5">
          <p className="text-sm text-[#6B6461]">Próximo turno</p>
          {proximo ? (
            <>
              <p className="mt-2 text-xl font-semibold">
                {textoDiaCorto(proximo.fecha)} · {proximo.hora.slice(0, 5)}
              </p>
              <p className="mt-1 text-[13px] text-[#6B6461]">
                {proximo.nombre_cliente}
                {proximo.servicios?.nombre ? ` · ${proximo.servicios.nombre}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-[#6B6461]">No hay turnos próximos.</p>
          )}
        </div>
      </div>

      {/* Filtro + referencias */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {profesionales.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por profesional">
            <Pastilla activa={filtroProf === "todas"} onClick={() => setFiltroProf("todas")}>
              Todo el equipo
            </Pastilla>
            {profesionales.map((p) => (
              <Pastilla key={p.id} activa={filtroProf === p.id} onClick={() => setFiltroProf(p.id)}>
                {p.nombre}
              </Pastilla>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#5B5451]">
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded" style={{ backgroundColor: `${color}33`, border: `1px solid ${color}99` }} />
            Seña pagada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border-[1.5px] border-dashed border-[#B07A2A]" />
            Esperando pago (30 min)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border" style={ESTILO_BLOQUEO} />
            Bloqueado
          </span>
        </div>
      </div>

      {errorCarga && <p className="text-sm text-red-700">{errorCarga}</p>}

      {/* Semana / Día */}
      {vista !== "mes" && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[#ECE6E0] bg-white">
            {cargando ? (
              <p className="p-6 text-[#6B6461]">Cargando agenda...</p>
            ) : diasVista.length === 0 || carriles.length === 0 ? (
              <p className="p-6 text-[#6B6461]">
                {carriles.length === 0 ? "Todavía no cargaste profesionales." : "Esta semana no atendés ningún día."}
              </p>
            ) : (
              <div
                className="grid p-2 pb-3"
                style={{
                  gridTemplateColumns: columnas,
                  gridTemplateRows: filas,
                  minWidth: 56 + diasVista.length * L * anchoMinimo + 16,
                }}
              >
                {/* Cabecera: días */}
                {diasVista.map((iso, i) => (
                  <div
                    key={iso}
                    className="flex items-center justify-center gap-2 border-b border-[#ECE6E0] text-sm font-semibold"
                    style={{ gridColumn: `${columnaDe(i, 0)} / span ${L}`, gridRow: 1 }}
                  >
                    {vista === "dia" ? textoDiaLargo(iso) : textoDiaCorto(iso)}
                    {iso === hoy && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-label="Hoy" />}
                  </div>
                ))}
                {/* Cabecera: profesionales */}
                {L > 1 &&
                  diasVista.map((iso, i) =>
                    carriles.map((p, j) => (
                      <div
                        key={`${iso}-${p.id}`}
                        className="flex items-center justify-center truncate px-1 text-xs text-[#6B6461]"
                        style={{ gridColumn: columnaDe(i, j), gridRow: 2 }}
                      >
                        {p.nombre}
                      </div>
                    ))
                  )}
                {/* Horas */}
                {Array.from({ length: Math.ceil(casilleros / 2) }, (_, k) => (
                  <div
                    key={k}
                    className="pr-2 pt-0.5 text-right text-xs text-[#6B6461]"
                    style={{ gridColumn: 1, gridRow: `${filasCabecera + 1 + k * 2} / span 2` }}
                  >
                    {horaDe(apertura + k * 2 * MINUTOS_CASILLERO)}
                  </div>
                ))}
                {/* Casilleros libres (tocables para bloquear) */}
                {diasVista.map((iso, i) =>
                  carriles.map((p, j) =>
                    Array.from({ length: casilleros }, (_, s) => {
                      const minutos = apertura + s * MINUTOS_CASILLERO;
                      const pasado = iso < hoy || (iso === hoy && minutos < ahoraMinutos);
                      const estilo = {
                        gridColumn: columnaDe(i, j),
                        gridRow: filasCabecera + 1 + s,
                        borderLeft: j === 0 ? "1px solid #ECE6E0" : "1px dashed #F1ECE7",
                      };
                      return pasado ? (
                        <div key={`${iso}-${p.id}-${s}`} className="border-t border-[#EFEAE5] bg-[#FAF8F6]" style={estilo} />
                      ) : (
                        <button
                          key={`${iso}-${p.id}-${s}`}
                          type="button"
                          onClick={() => abrirHueco(iso, minutos, p.id)}
                          aria-label={`Bloquear ${textoDiaCorto(iso)} ${horaDe(minutos)}${L > 1 ? ` con ${p.nombre}` : ""}`}
                          className="border-t border-[#EFEAE5] hover:bg-[#F3EFEA]"
                          style={estilo}
                        />
                      );
                    })
                  )
                )}
                {/* Turnos */}
                {eventos.map(({ r, columna, fila, largo }) => {
                  const estilo = {
                    gridColumn: columna,
                    gridRow: `${fila} / span ${largo}`,
                    ...(r.visual === "confirmada" && { backgroundColor: `${color}33`, borderColor: `${color}99` }),
                    ...(r.visual === "bloqueo" && ESTILO_BLOQUEO),
                  };
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSeleccion(r);
                        setConfirmandoCancelar(false);
                      }}
                      className={`relative z-10 m-0.5 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs leading-snug ${
                        r.visual === "pendiente" ? "border-[1.5px] border-dashed border-[#B07A2A] bg-white" : ""
                      }`}
                      style={estilo}
                    >
                      <span className="block truncate text-[13px] font-semibold">{r.nombre_cliente}</span>
                      {largo > 1 && (
                        <span className="block truncate text-[#5B5451]">
                          {r.visual === "bloqueo" ? "Bloqueado" : r.servicios?.nombre || ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="-mt-3 text-[13px] text-[#6B6461]">
            Tocá un turno para ver sus datos, o un horario libre para bloquearlo.
          </p>
        </>
      )}

      {/* Mes */}
      {vista === "mes" && (
        <div className="rounded-2xl border border-[#ECE6E0] bg-white p-3 sm:p-5">
          <div className="mb-2 grid grid-cols-7 gap-1.5 text-xs text-[#6B6461]">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdasMes.map((iso, k) => {
              if (!iso) return <div key={`vacio-${k}`} />;
              const cerrado = !diasAtencion.includes(diaSemana(iso));
              const cantidad = visibles.filter(
                (r) => r.fecha === iso && r.visual !== "bloqueo" && (filtroProf === "todas" || r.profesional_id === filtroProf)
              ).length;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setFechaRef(iso);
                    setVista("dia");
                  }}
                  className={`flex min-h-16 flex-col items-start gap-0.5 rounded-xl border p-1.5 text-left text-xs sm:min-h-20 sm:p-2 sm:text-[13px] ${
                    cerrado ? "border-transparent bg-[#F3F0EC] text-[#9A928D]" : "border-[#ECE6E0] bg-white hover:border-[#1E1B1A]"
                  }`}
                >
                  <span className={`font-semibold ${iso === hoy ? "rounded-full px-1.5 text-white" : ""}`} style={iso === hoy ? { backgroundColor: color } : undefined}>
                    {aFecha(iso).getDate()}
                  </span>
                  <span>{cerrado ? "Cerrado" : cantidad ? `${cantidad} ${cantidad === 1 ? "turno" : "turnos"}` : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ficha del turno */}
      {seleccion && (
        <Ventana
          titulo={seleccion.bloqueo_manual ? "Horario bloqueado" : seleccion.nombre_cliente}
          onCerrar={() => setSeleccion(null)}
        >
          <span
            className="self-start rounded-full px-3 py-1 text-[13px]"
            style={
              seleccion.visual === "confirmada"
                ? { backgroundColor: "#E3F1E7", color: "#1E5B33" }
                : seleccion.visual === "pendiente"
                  ? { backgroundColor: "#FBF0DC", color: "#7A4A0C" }
                  : { backgroundColor: "#EFEBE6", color: "#5B5451" }
            }
          >
            {seleccion.id_pago_mercadopago === "demo" ? "Seña simulada (demo)" : ETIQUETA_ESTADO[seleccion.visual]}
          </span>
          <dl className="text-[15px]">
            {[
              seleccion.bloqueo_manual ? ["Motivo", seleccion.nombre_cliente] : ["Servicio", seleccion.servicios?.nombre],
              ["Profesional", seleccion.profesionales?.nombre],
              [
                "Cuándo",
                `${textoDiaLargo(seleccion.fecha)} · ${seleccion.hora.slice(0, 5)} a ${horaFin(seleccion.hora.slice(0, 5), seleccion.duracion_minutos)}`,
              ],
              !seleccion.bloqueo_manual && ["Sucursal", seleccion.sucursales?.nombre],
              !seleccion.bloqueo_manual && ["Teléfono", seleccion.telefono_cliente],
              !seleccion.bloqueo_manual && ["Email", seleccion.email_cliente],
              !seleccion.bloqueo_manual && ["Seña", plata(seleccion.monto_sena)],
            ]
              .filter((fila) => fila && fila[1])
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-t border-[#EFEAE5] py-2.5">
                  <dt className="text-[#6B6461]">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
          </dl>
          <div className="flex flex-wrap gap-2.5">
            {!seleccion.bloqueo_manual &&
              linkWhatsApp(
                seleccion.telefono_cliente,
                `Hola ${seleccion.nombre_cliente.split(" ")[0]}, te escribo de ${negocio.nombre} por tu turno del ${textoDiaLargo(seleccion.fecha).toLowerCase()} a las ${seleccion.hora.slice(0, 5)}.`
              ) && (
                <a
                  href={linkWhatsApp(
                    seleccion.telefono_cliente,
                    `Hola ${seleccion.nombre_cliente.split(" ")[0]}, te escribo de ${negocio.nombre} por tu turno del ${textoDiaLargo(seleccion.fecha).toLowerCase()} a las ${seleccion.hora.slice(0, 5)}.`
                  )}
                  target="_blank"
                  rel="noopener"
                  className="flex min-h-11 items-center rounded-full bg-[#1E1B1A] px-5 font-semibold text-white"
                >
                  Escribir por WhatsApp
                </a>
              )}
            {confirmandoCancelar ? (
              <>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={cancelarSeleccion}
                  className="min-h-11 rounded-full bg-[#A3262A] px-5 font-semibold text-white disabled:opacity-60"
                >
                  {seleccion.bloqueo_manual ? "Sí, quitar bloqueo" : "Sí, cancelar turno"}
                </button>
                <button type="button" onClick={() => setConfirmandoCancelar(false)} className="min-h-11 rounded-full border border-[#DCD5CE] px-5">
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoCancelar(true)}
                className="min-h-11 rounded-full border border-[#E7C9C9] px-5 text-[#A3262A]"
              >
                {seleccion.bloqueo_manual ? "Quitar bloqueo" : "Cancelar turno"}
              </button>
            )}
          </div>
          {confirmandoCancelar && !seleccion.bloqueo_manual && (
            <p className="text-[13px] text-[#6B6461]">
              El horario vuelve a estar libre. La seña no se devuelve sola: si corresponde, hacelo desde tu cuenta de Mercado Pago.
            </p>
          )}
        </Ventana>
      )}

      {/* Bloquear un horario libre */}
      {hueco && (
        <Ventana
          titulo="Bloquear horario"
          subtitulo={`${textoDiaLargo(hueco.fecha)} · desde las ${horaDe(hueco.minutos)}`}
          onCerrar={() => setHueco(null)}
        >
          {profesionales.length > 1 && (
            <div>
              <p className="mb-2 text-[13px] text-[#5B5451]">Profesional</p>
              <div className="flex flex-wrap gap-2">
                {profesionales.map((p) => (
                  <Pastilla key={p.id} activa={hueco.profesionalId === p.id} onClick={() => setHueco({ ...hueco, profesionalId: p.id })}>
                    {p.nombre}
                  </Pastilla>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-[13px] text-[#5B5451]">Duración</p>
            <div className="flex flex-wrap gap-2">
              {[
                [30, "30 min"],
                [60, "1 h"],
                [90, "1 h 30"],
                [120, "2 h"],
                [cierre - hueco.minutos, "Hasta el cierre"],
              ].map(([minutos, label]) => {
                const noEntra =
                  hueco.minutos + minutos > cierre ||
                  seSuperpone(hueco.fecha, hueco.minutos, minutos, hueco.profesionalId);
                return (
                  <Pastilla
                    key={label}
                    activa={duracionBloqueo === minutos}
                    disabled={noEntra}
                    title={noEntra ? "Se superpone con otro turno o pasa el horario de cierre" : undefined}
                    onClick={() => setDuracionBloqueo(minutos)}
                  >
                    {label}
                  </Pastilla>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451]">
            Motivo (opcional)
            <input
              type="text"
              value={motivoBloqueo}
              onChange={(e) => setMotivoBloqueo(e.target.value)}
              placeholder="Turno por WhatsApp, almuerzo…"
              className="min-h-11 rounded-xl border border-[#DCD5CE] px-3 text-base text-[#1E1B1A] focus:border-[#1E1B1A] focus:outline-none"
            />
          </label>
          {seSuperpone(hueco.fecha, hueco.minutos, duracionBloqueo, hueco.profesionalId) ||
          hueco.minutos + duracionBloqueo > cierre ? (
            <p className="text-[13px] text-red-700">Esa duración se superpone con otro turno. Elegí una más corta.</p>
          ) : null}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={
                guardando ||
                hueco.minutos + duracionBloqueo > cierre ||
                seSuperpone(hueco.fecha, hueco.minutos, duracionBloqueo, hueco.profesionalId)
              }
              onClick={bloquear}
              className="min-h-11 rounded-full bg-[#1E1B1A] px-6 font-semibold text-white disabled:opacity-50"
            >
              {guardando ? "Bloqueando..." : "Bloquear"}
            </button>
            <button type="button" onClick={() => setHueco(null)} className="min-h-11 rounded-full border border-[#DCD5CE] px-5">
              Cancelar
            </button>
          </div>
        </Ventana>
      )}
    </div>
  );
}
