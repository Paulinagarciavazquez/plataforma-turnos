import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generarHorariosInicio, horarioDelDia, fechaCerrada } from "@/lib/horarios";
import { calcularMontoSena } from "@/lib/reservas";

// Turnos de ejemplo para los negocios en modo demo (hoy, el piloto "by
// olivia"): así el panel de la demo siempre muestra una agenda con
// movimiento en la semana actual cuando se la mostramos a un posible
// cliente. Lo llama la tarea diaria (api/cron/recordatorios).
//
// - Completa desde hace 14 días hasta dentro de 13 días; un día que ya tiene
//   turnos de ejemplo no se vuelve a tocar.
// - 2 a 4 turnos por profesional y por día, con los servicios que hace cada
//   una, dentro del horario de ese día y sin pisar cierres, ausencias ni las
//   reservas reales de quien esté probando la demo.
// - Se marcan con origen = "demo-auto", sin email (no mandan mails ni
//   recordatorios, ni gastan el cupo de Resend) y se borran solos a los 30
//   días.
// - Solo actúa sobre negocios con modo_demo = true: nunca toca un negocio real.

export const ORIGEN_DEMO = "demo-auto";
const DIAS_ATRAS = 14;
const DIAS_ADELANTE = 13;
const DIAS_QUE_SE_GUARDAN = 30;
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const NOMBRES = [
  "Sofía R.", "Lucía P.", "Martina G.", "Valentina D.", "Camila S.", "Julieta M.", "Florencia A.", "Agustina P.",
  "Belén C.", "Rocío L.", "Paula F.", "Carla V.", "Mora T.", "Emma R.", "Natalia B.", "Ana M.", "Milagros O.",
  "Abril N.", "Josefina H.", "Victoria E.", "Micaela Z.", "Antonella Q.", "Delfina K.", "Pilar I.",
];

function fechaArgentina(sumarDias) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(
    new Date(Date.now() + sumarDias * 24 * 60 * 60 * 1000)
  );
}

function minutosDe(hora) {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// Números "al azar" pero siempre los mismos para el mismo día y profesional.
function azarDesde(texto) {
  let semilla = 0;
  for (const c of texto) semilla = (semilla * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    semilla = (semilla + 0x6d2b79f5) >>> 0;
    let t = semilla;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function renovarNegocio(negocio) {
  const desde = fechaArgentina(-DIAS_ATRAS);
  const hasta = fechaArgentina(DIAS_ADELANTE);

  // 1) Borrar los turnos de ejemplo viejos.
  await supabaseAdmin
    .from("reservas")
    .delete()
    .eq("negocio_id", negocio.id)
    .eq("origen", ORIGEN_DEMO)
    .lt("fecha", fechaArgentina(-DIAS_QUE_SE_GUARDAN));

  const [{ data: profesionales }, { data: vinculos }, { data: existentes }, { data: cierres }, { data: ausencias }] =
    await Promise.all([
      supabaseAdmin.from("profesionales").select("id, sucursal_id").eq("negocio_id", negocio.id),
      supabaseAdmin
        .from("servicios_profesionales")
        .select("profesional_id, servicios!inner(id, precio, duracion_minutos, negocio_id)")
        .eq("servicios.negocio_id", negocio.id),
      supabaseAdmin
        .from("reservas")
        .select("fecha, hora, duracion_minutos, profesional_id, origen, estado")
        .eq("negocio_id", negocio.id)
        .neq("estado", "cancelada")
        .gte("fecha", desde)
        .lte("fecha", hasta),
      supabaseAdmin.from("cierres_negocio").select("desde, hasta").eq("negocio_id", negocio.id),
      supabaseAdmin
        .from("ausencias_profesionales")
        .select("profesional_id, fecha")
        .eq("negocio_id", negocio.id)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    ]);

  const diasConEjemplos = new Set((existentes || []).filter((r) => r.origen === ORIGEN_DEMO).map((r) => r.fecha));
  const ocupados = [...(existentes || [])];
  const nuevas = [];

  for (let n = -DIAS_ATRAS; n <= DIAS_ADELANTE; n++) {
    const fecha = fechaArgentina(n);
    if (diasConEjemplos.has(fecha)) continue;
    const horario = horarioDelDia(negocio, fecha);
    if (!horario || fechaCerrada(fecha, cierres)) continue;

    for (const profesional of profesionales || []) {
      if ((ausencias || []).some((a) => a.fecha === fecha && a.profesional_id === profesional.id)) continue;
      const servicios = (vinculos || []).filter((v) => v.profesional_id === profesional.id).map((v) => v.servicios);
      if (servicios.length === 0) continue;

      const azar = azarDesde(`${negocio.id}-${fecha}-${profesional.id}`);
      const cantidad = 2 + Math.floor(azar() * 3); // 2 a 4
      for (let i = 0; i < cantidad * 4 && nuevas.filter((x) => x.fecha === fecha && x.profesional_id === profesional.id).length < cantidad; i++) {
        const servicio = servicios[Math.floor(azar() * servicios.length)];
        const posibles = generarHorariosInicio(horario.desde, horario.hasta, servicio.duracion_minutos);
        if (posibles.length === 0) continue;
        const hora = posibles[Math.floor(azar() * posibles.length)];
        const inicio = minutosDe(hora);
        const choca = [...ocupados, ...nuevas].some(
          (r) =>
            r.fecha === fecha &&
            r.profesional_id === profesional.id &&
            inicio < minutosDe(r.hora) + r.duracion_minutos &&
            minutosDe(r.hora) < inicio + servicio.duracion_minutos
        );
        if (choca) continue;

        nuevas.push({
          negocio_id: negocio.id,
          sucursal_id: profesional.sucursal_id,
          servicio_id: servicio.id,
          profesional_id: profesional.id,
          nombre_cliente: NOMBRES[Math.floor(azar() * NOMBRES.length)],
          telefono_cliente: `261555${String(Math.floor(azar() * 10000)).padStart(4, "0")}`,
          email_cliente: null,
          fecha,
          hora,
          duracion_minutos: servicio.duracion_minutos,
          estado: "confirmada",
          monto_sena: calcularMontoSena(negocio, servicio),
          id_pago_mercadopago: "demo",
          recordatorio_enviado_en: new Date().toISOString(),
          origen: ORIGEN_DEMO,
        });
      }
    }
  }

  if (nuevas.length) {
    const { error } = await supabaseAdmin.from("reservas").insert(nuevas);
    if (error) {
      console.error("Error cargando turnos de ejemplo de la demo:", error);
      return 0;
    }
  }
  return nuevas.length;
}

export async function renovarTurnosDeDemo() {
  const { data: negocios, error } = await supabaseAdmin
    .from("negocios")
    .select("id, dias_atencion, horarios_por_dia, horario_apertura, horario_cierre, tipo_sena, porcentaje_o_monto_sena")
    .eq("modo_demo", true);
  if (error) {
    console.error("Error buscando negocios demo:", error);
    return 0;
  }
  let total = 0;
  for (const negocio of negocios || []) total += await renovarNegocio(negocio);
  return total;
}
