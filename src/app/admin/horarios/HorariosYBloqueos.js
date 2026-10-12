"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { aIso, horarioDelDiaSemana } from "../../../lib/horarios";

// "Horarios y bloqueos" (paso 4 del rediseño del panel), en una sola
// pantalla:
// 1. Horario de atención, uno por cada día de la semana
//    (negocios.dias_atencion + negocios.horarios_por_dia).
// 2. Feriados y cierres del local: nadie puede reservar esos días
//    (tabla cierres_negocio).
// 3. Vacaciones y ausencias del equipo, por rango de fechas: se guardan como
//    una fila por día en ausencias_profesionales (la misma tabla de siempre,
//    así el flujo de reserva las respeta sin cambios) y acá se muestran
//    agrupadas en rangos.

const DIAS = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [0, "Domingo"],
];
const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function aFecha(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sumarDias(iso, n) {
  const f = aFecha(iso);
  f.setDate(f.getDate() + n);
  return aIso(f);
}
function diasEntre(desde, hasta) {
  const dias = [];
  for (let iso = desde; iso <= hasta; iso = sumarDias(iso, 1)) dias.push(iso);
  return dias;
}
function textoRango(desde, hasta) {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  if (desde === hasta) return `${DIAS_CORTO[a.getDay()]} ${a.getDate()} de ${MESES[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
}

const claseInput =
  "min-h-11 rounded-xl border border-[#DCD5CE] bg-white px-3 text-base text-[#1E1B1A] focus:border-[#1E1B1A] focus:outline-none";
const claseBotonOscuro =
  "min-h-11 rounded-full bg-[#1E1B1A] px-5 font-semibold text-white transition hover:bg-black disabled:opacity-50";
const claseBotonClaro = "min-h-11 rounded-full border border-[#DCD5CE] bg-white px-5 text-[#1E1B1A] disabled:opacity-50";
const claseTarjeta = "rounded-2xl border border-[#ECE6E0] bg-white p-5 md:p-6";

function Mensaje({ mensaje }) {
  if (!mensaje) return null;
  return (
    <p role="status" className={`text-sm ${mensaje.tipo === "error" ? "text-red-700" : mensaje.tipo === "aviso" ? "text-[#7A4A0C]" : "text-[#1E5B33]"}`}>
      {mensaje.texto}
    </p>
  );
}

// Cuenta los turnos de clientes (no bloqueos) que ya están tomados en esas
// fechas — de un profesional puntual, o de todos si no se indica.
async function contarTurnosTomados(negocioId, desde, hasta, profesionalId) {
  let consulta = supabase
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocioId)
    .eq("bloqueo_manual", false)
    .eq("estado", "confirmada")
    .gte("fecha", desde)
    .lte("fecha", hasta);
  if (profesionalId) consulta = consulta.eq("profesional_id", profesionalId);
  const { count } = await consulta;
  return count || 0;
}

// ---------------------------------------------------------------------------
// 1. Horario de atención
// ---------------------------------------------------------------------------
function HorarioDeAtencion({ negocio, actualizarNegocio }) {
  const [semana, setSemana] = useState(() =>
    Object.fromEntries(
      DIAS.map(([valor]) => {
        const horario = horarioDelDiaSemana(negocio, valor);
        return [
          valor,
          {
            abre: Boolean(horario),
            desde: horario?.desde || (negocio.horario_apertura || "09:00").slice(0, 5),
            hasta: horario?.hasta || (negocio.horario_cierre || "18:00").slice(0, 5),
          },
        ];
      })
    )
  );
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  function cambiar(dia, campo, valor) {
    setSemana((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }));
    setMensaje(null);
  }

  function copiarLunesATodos() {
    setSemana((prev) =>
      Object.fromEntries(Object.entries(prev).map(([dia, h]) => [dia, { ...h, desde: prev[1].desde, hasta: prev[1].hasta }]))
    );
    setMensaje(null);
  }

  async function guardar() {
    const abiertos = DIAS.filter(([valor]) => semana[valor].abre);
    if (abiertos.length === 0) {
      setMensaje({ tipo: "error", texto: "Marcá al menos un día en que atiendas." });
      return;
    }
    const malo = abiertos.find(([valor]) => !semana[valor].desde || !semana[valor].hasta || semana[valor].hasta <= semana[valor].desde);
    if (malo) {
      setMensaje({ tipo: "error", texto: `Revisá el ${malo[1].toLowerCase()}: el horario de cierre tiene que ser después del de apertura.` });
      return;
    }

    const horariosPorDia = Object.fromEntries(
      abiertos.map(([valor]) => [String(valor), { desde: semana[valor].desde, hasta: semana[valor].hasta }])
    );
    const cambios = {
      dias_atencion: abiertos.map(([valor]) => valor),
      horarios_por_dia: horariosPorDia,
      // El horario "general" queda como el rango más amplio, por si algo
      // todavía lo usa como respaldo.
      horario_apertura: abiertos.map(([v]) => semana[v].desde).sort()[0],
      horario_cierre: abiertos.map(([v]) => semana[v].hasta).sort().at(-1),
    };

    setGuardando(true);
    const { error } = await supabase.from("negocios").update(cambios).eq("id", negocio.id);
    setGuardando(false);

    if (error) {
      console.error("Error guardando horario:", error);
      setMensaje({
        tipo: "error",
        texto:
          error.code === "PGRST204" || error.code === "42703"
            ? "Falta actualizar la base de datos para guardar un horario por día."
            : "No pudimos guardar el horario. Probá de nuevo.",
      });
      return;
    }

    actualizarNegocio({ ...negocio, ...cambios });
    setMensaje({ tipo: "exito", texto: "Horario guardado. Tu web de reservas ya usa el horario nuevo." });
  }

  return (
    <section className={claseTarjeta} aria-labelledby="titulo-horario">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-horario" className="text-lg font-semibold">
            Horario de atención
          </h2>
          <p className="text-sm text-[#6B6461]">Cada día puede tener su propio horario.</p>
        </div>
        <button type="button" onClick={copiarLunesATodos} className="min-h-10 rounded-full border border-[#DCD5CE] px-4 text-sm">
          Copiar el lunes a todos
        </button>
      </div>

      <div className="mt-3">
        {DIAS.map(([valor, nombre]) => {
          const dia = semana[valor];
          return (
            <div key={valor} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEAE5] py-3">
              <label className="flex min-w-32 items-center gap-3 text-[15px]">
                <input
                  type="checkbox"
                  checked={dia.abre}
                  onChange={(e) => cambiar(valor, "abre", e.target.checked)}
                  className="h-5 w-5 accent-[#1E1B1A]"
                />
                {nombre}
              </label>
              {dia.abre ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    step="1800"
                    aria-label={`${nombre}: abre a las`}
                    value={dia.desde}
                    onChange={(e) => cambiar(valor, "desde", e.target.value)}
                    className={claseInput}
                  />
                  <span className="text-[#6B6461]">a</span>
                  <input
                    type="time"
                    step="1800"
                    aria-label={`${nombre}: cierra a las`}
                    value={dia.hasta}
                    onChange={(e) => cambiar(valor, "hasta", e.target.value)}
                    className={claseInput}
                  />
                </div>
              ) : (
                <span className="text-[15px] text-[#9A928D]">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={claseBotonOscuro}>
          {guardando ? "Guardando..." : "Guardar horario"}
        </button>
        <Mensaje mensaje={mensaje} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Feriados y cierres del local
// ---------------------------------------------------------------------------
function CierresDelLocal({ negocio }) {
  const hoy = aIso(new Date());
  const [cierres, setCierres] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [recargar, setRecargar] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const { data, error } = await supabase
        .from("cierres_negocio")
        .select("id, desde, hasta, motivo")
        .eq("negocio_id", negocio.id)
        .gte("hasta", hoy)
        .order("desde");
      setCargando(false);
      if (error) {
        console.error("Error cargando cierres:", error);
        setMensaje({ tipo: "error", texto: "No pudimos cargar los cierres (falta actualizar la base de datos)." });
        return;
      }
      setCierres(data || []);
    }
    cargar();
  }, [negocio.id, hoy, recargar]);

  async function guardar(e) {
    e.preventDefault();
    const fin = hasta || desde;
    if (!desde) {
      setMensaje({ tipo: "error", texto: "Elegí desde qué día cerrás." });
      return;
    }
    if (fin < desde) {
      setMensaje({ tipo: "error", texto: "La fecha “hasta” tiene que ser igual o posterior a “desde”." });
      return;
    }

    setGuardando(true);
    const { error } = await supabase
      .from("cierres_negocio")
      .insert({ negocio_id: negocio.id, desde, hasta: fin, motivo: motivo.trim() || null });
    const tomados = error ? 0 : await contarTurnosTomados(negocio.id, desde, fin);
    setGuardando(false);

    if (error) {
      console.error("Error guardando cierre:", error);
      setMensaje({ tipo: "error", texto: "No pudimos guardar el cierre. Probá de nuevo." });
      return;
    }

    setFormAbierto(false);
    setDesde("");
    setHasta("");
    setMotivo("");
    setRecargar((n) => n + 1);
    setMensaje(
      tomados
        ? {
            tipo: "aviso",
            texto: `Cierre guardado. Ojo: ya hay ${tomados} ${tomados === 1 ? "turno tomado" : "turnos tomados"} en esas fechas. El cierre no los cancela: escribiles y cancelalos desde la Agenda.`,
          }
        : { tipo: "exito", texto: "Cierre guardado: esos días ya no se pueden reservar." }
    );
  }

  async function quitar(cierre) {
    if (!window.confirm(`¿Quitar el cierre del ${textoRango(cierre.desde, cierre.hasta)}? Esos días se vuelven a poder reservar.`)) return;
    const { error } = await supabase.from("cierres_negocio").delete().eq("id", cierre.id);
    if (error) {
      setMensaje({ tipo: "error", texto: "No pudimos quitarlo. Probá de nuevo." });
      return;
    }
    setMensaje({ tipo: "exito", texto: "Cierre quitado." });
    setRecargar((n) => n + 1);
  }

  return (
    <section className={claseTarjeta} aria-labelledby="titulo-cierres">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-cierres" className="text-lg font-semibold">
            Feriados y cierres del local
          </h2>
          <p className="text-sm text-[#6B6461]">Esos días no se puede reservar con nadie.</p>
        </div>
        {!formAbierto && (
          <button type="button" onClick={() => setFormAbierto(true)} className="min-h-10 rounded-full border border-[#DCD5CE] px-4 text-sm">
            + Agregar cierre
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={guardar} className="mt-4 grid gap-3 rounded-xl bg-[#F6F4F1] p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451]">
            Desde
            <input type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} className={claseInput} required />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451]">
            Hasta (si es un solo día, dejalo vacío)
            <input type="date" min={desde || hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseInput} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451] sm:col-span-2">
            Motivo (opcional, lo ves en tu agenda)
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Feriado, vacaciones del local, mudanza…"
              className={claseInput}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={guardando} className={claseBotonOscuro}>
              {guardando ? "Guardando..." : "Guardar cierre"}
            </button>
            <button type="button" onClick={() => setFormAbierto(false)} className={claseBotonClaro}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-3">
        <Mensaje mensaje={mensaje} />
      </div>

      {cargando ? (
        <p className="mt-3 text-sm text-[#6B6461]">Cargando...</p>
      ) : cierres.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B6461]">No tenés cierres cargados.</p>
      ) : (
        <ul className="mt-2">
          {cierres.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEAE5] py-3 text-[15px]">
              <span>
                <span className="font-semibold">{textoRango(c.desde, c.hasta)}</span>
                {c.motivo ? ` · ${c.motivo}` : ""}
              </span>
              <button type="button" onClick={() => quitar(c)} className="min-h-9 rounded-full border border-[#DCD5CE] px-4 text-sm">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Vacaciones y ausencias del equipo
// ---------------------------------------------------------------------------

// Agrupa las ausencias (una fila por día) en rangos de días seguidos de la
// misma profesional con el mismo motivo.
function agruparEnRangos(filas) {
  const ordenadas = [...filas].sort(
    (a, b) => a.profesional_id.localeCompare(b.profesional_id) || a.fecha.localeCompare(b.fecha)
  );
  const rangos = [];
  for (const fila of ordenadas) {
    const ultimo = rangos.at(-1);
    if (
      ultimo &&
      ultimo.profesional_id === fila.profesional_id &&
      (ultimo.motivo || "") === (fila.motivo || "") &&
      sumarDias(ultimo.hasta, 1) === fila.fecha
    ) {
      ultimo.hasta = fila.fecha;
      ultimo.ids.push(fila.id);
    } else {
      rangos.push({ profesional_id: fila.profesional_id, motivo: fila.motivo, desde: fila.fecha, hasta: fila.fecha, ids: [fila.id] });
    }
  }
  return rangos.sort((a, b) => a.desde.localeCompare(b.desde));
}

function AusenciasDelEquipo({ negocio }) {
  const hoy = aIso(new Date());
  const [profesionales, setProfesionales] = useState([]);
  const [ausencias, setAusencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [recargar, setRecargar] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const [profesionalId, setProfesionalId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const [{ data: profs }, { data: aus, error }] = await Promise.all([
        supabase.from("profesionales").select("id, nombre").eq("negocio_id", negocio.id).order("nombre"),
        supabase
          .from("ausencias_profesionales")
          .select("id, profesional_id, fecha, motivo")
          .eq("negocio_id", negocio.id)
          .gte("fecha", hoy),
      ]);
      setCargando(false);
      if (error) {
        console.error("Error cargando ausencias:", error);
        setMensaje({ tipo: "error", texto: "No pudimos cargar las ausencias." });
        return;
      }
      setProfesionales(profs || []);
      setAusencias(aus || []);
    }
    cargar();
  }, [negocio.id, hoy, recargar]);

  const nombreDe = (id) => profesionales.find((p) => p.id === id)?.nombre || "Profesional";
  const rangos = agruparEnRangos(ausencias);

  async function guardar(e) {
    e.preventDefault();
    const fin = hasta || desde;
    if (!profesionalId || !desde) {
      setMensaje({ tipo: "error", texto: "Elegí quién y desde qué día." });
      return;
    }
    if (fin < desde) {
      setMensaje({ tipo: "error", texto: "La fecha “hasta” tiene que ser igual o posterior a “desde”." });
      return;
    }
    const dias = diasEntre(desde, fin);
    if (dias.length > 120) {
      setMensaje({ tipo: "error", texto: "El rango es muy largo: cargalo de a tramos de hasta 4 meses." });
      return;
    }

    setGuardando(true);
    const { error } = await supabase.from("ausencias_profesionales").upsert(
      dias.map((fecha) => ({ negocio_id: negocio.id, profesional_id: profesionalId, fecha, motivo: motivo.trim() || null })),
      { onConflict: "profesional_id,fecha", ignoreDuplicates: true }
    );
    const tomados = error ? 0 : await contarTurnosTomados(negocio.id, desde, fin, profesionalId);
    setGuardando(false);

    if (error) {
      console.error("Error guardando ausencia:", error);
      setMensaje({ tipo: "error", texto: "No pudimos guardar la ausencia. Probá de nuevo." });
      return;
    }

    setFormAbierto(false);
    setDesde("");
    setHasta("");
    setMotivo("");
    setRecargar((n) => n + 1);
    setMensaje(
      tomados
        ? {
            tipo: "aviso",
            texto: `Ausencia guardada. Ojo: ${nombreDe(profesionalId)} ya tiene ${tomados} ${tomados === 1 ? "turno tomado" : "turnos tomados"} en esas fechas. Escribiles y cancelalos desde la Agenda.`,
          }
        : { tipo: "exito", texto: `Ausencia guardada: ${nombreDe(profesionalId)} no recibe turnos esos días.` }
    );
  }

  async function quitar(rango) {
    if (!window.confirm(`¿Quitar la ausencia de ${nombreDe(rango.profesional_id)} (${textoRango(rango.desde, rango.hasta)})?`)) return;
    const { error } = await supabase.from("ausencias_profesionales").delete().in("id", rango.ids);
    if (error) {
      setMensaje({ tipo: "error", texto: "No pudimos quitarla. Probá de nuevo." });
      return;
    }
    setMensaje({ tipo: "exito", texto: "Ausencia quitada." });
    setRecargar((n) => n + 1);
  }

  return (
    <section className={claseTarjeta} aria-labelledby="titulo-ausencias">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-ausencias" className="text-lg font-semibold">
            Vacaciones y ausencias del equipo
          </h2>
          <p className="text-sm text-[#6B6461]">Solo esa persona deja de recibir turnos; el resto sigue igual.</p>
        </div>
        {!formAbierto && profesionales.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setFormAbierto(true);
              setProfesionalId((actual) => actual || profesionales[0].id);
            }}
            className="min-h-10 rounded-full border border-[#DCD5CE] px-4 text-sm"
          >
            + Agregar ausencia
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={guardar} className="mt-4 grid gap-3 rounded-xl bg-[#F6F4F1] p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451] sm:col-span-2">
            Profesional
            <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} className={claseInput}>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451]">
            Desde
            <input type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} className={claseInput} required />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451]">
            Hasta (si es un solo día, dejalo vacío)
            <input type="date" min={desde || hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseInput} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-[#5B5451] sm:col-span-2">
            Motivo (opcional)
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Vacaciones, licencia, curso…"
              className={claseInput}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={guardando} className={claseBotonOscuro}>
              {guardando ? "Guardando..." : "Guardar ausencia"}
            </button>
            <button type="button" onClick={() => setFormAbierto(false)} className={claseBotonClaro}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-3">
        <Mensaje mensaje={mensaje} />
      </div>

      {cargando ? (
        <p className="mt-3 text-sm text-[#6B6461]">Cargando...</p>
      ) : profesionales.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B6461]">Todavía no cargaste profesionales (se cargan en “Servicios y equipo”).</p>
      ) : rangos.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B6461]">No hay ausencias cargadas.</p>
      ) : (
        <ul className="mt-2">
          {rangos.map((r) => (
            <li key={r.ids[0]} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEAE5] py-3 text-[15px]">
              <span>
                <span className="font-semibold">{nombreDe(r.profesional_id)}</span> · {textoRango(r.desde, r.hasta)}
                {r.motivo ? ` · ${r.motivo}` : ""}
              </span>
              <button type="button" onClick={() => quitar(r)} className="min-h-9 rounded-full border border-[#DCD5CE] px-4 text-sm">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HorariosYBloqueos({ negocio, actualizarNegocio }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <HorarioDeAtencion negocio={negocio} actualizarNegocio={actualizarNegocio} />
      <div className="flex flex-col gap-4">
        <CierresDelLocal negocio={negocio} />
        <AusenciasDelEquipo negocio={negocio} />
      </div>
    </div>
  );
}
