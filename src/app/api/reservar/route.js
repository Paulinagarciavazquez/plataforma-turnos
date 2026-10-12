import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generarHorariosInicio, horarioDelDia, fechaCerrada } from "@/lib/horarios";
import { calcularMontoSena, MINUTOS_PARA_PAGAR } from "@/lib/reservas";

// Crea la reserva de un cliente (estado "pendiente_pago"). Antes se creaba
// directo desde el navegador; ahora pasa siempre por acá para poder
// controlar, del lado del servidor, que todo tenga sentido y frenar abusos
// (revisión de seguridad del 12/10/2026, punto 4):
// - el servicio, la profesional y la sucursal son de ese negocio;
// - el día y la hora entran en el horario de atención de ESE día, no es un
//   día de cierre ni de ausencia, y el horario sigue libre;
// - cada visitante tiene un límite de reservas sin pagar y por hora, para
//   que nadie pueda llenar la agenda de un negocio con reservas falsas (ni
//   usar la demo para mandar mails a cualquiera).
// El visitante se identifica con un código anónimo (hash de su IP con una
// clave del servidor): la IP en sí nunca se guarda.

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
const DIAS_MAXIMOS_ADELANTE = 45;
const MAX_SIN_PAGAR_POR_VISITANTE = 2; // reservas esperando pago a la vez, por negocio
const MAX_POR_HORA_POR_VISITANTE = 6; // reservas creadas en la última hora, en total

function hoyEnArgentina(sumarDias = 0) {
  const fecha = new Date(Date.now() + sumarDias * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(fecha);
}

function codigoDeVisitante(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
  const clave = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "agenda-estudio";
  return crypto.createHmac("sha256", clave).update(ip).digest("hex").slice(0, 32);
}

function minutosDe(hora) {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function error(texto, status = 400) {
  return NextResponse.json({ error: texto }, { status });
}

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => ({}));
    const negocioId = String(cuerpo.negocioId || "");
    const servicioId = String(cuerpo.servicioId || "");
    const profesionalId = cuerpo.profesionalId ? String(cuerpo.profesionalId) : null;
    const sucursalId = cuerpo.sucursalId ? String(cuerpo.sucursalId) : null;
    const fecha = String(cuerpo.fecha || "");
    const hora = String(cuerpo.hora || "").slice(0, 5);
    const nombre = String(cuerpo.nombre || "").trim().slice(0, 80);
    const telefono = String(cuerpo.telefono || "").trim().slice(0, 30);
    const email = String(cuerpo.email || "").trim().slice(0, 120);

    // ---- Datos básicos ----
    if (!negocioId || !servicioId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
      return error("Faltan datos de la reserva. Volvé a elegir el día y el horario.");
    }
    if (!nombre || !telefono || !email) {
      return error("Necesitamos tu nombre, un teléfono y un email para mandarte el comprobante.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error("Revisá el email: no parece válido.");
    }
    if (!/^[\d\s()+-]{6,30}$/.test(telefono)) {
      return error("Revisá el teléfono: usá solo números.");
    }

    // ---- Límite por visitante ----
    const origen = codigoDeVisitante(request);
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const vencimientoPendientes = new Date(Date.now() - MINUTOS_PARA_PAGAR * 60 * 1000).toISOString();
    const [{ count: ultimaHora }, { count: sinPagar }] = await Promise.all([
      supabaseAdmin
        .from("reservas")
        .select("id", { count: "exact", head: true })
        .eq("origen", origen)
        .gte("creado_en", haceUnaHora),
      supabaseAdmin
        .from("reservas")
        .select("id", { count: "exact", head: true })
        .eq("origen", origen)
        .eq("negocio_id", negocioId)
        .eq("estado", "pendiente_pago")
        .gte("creado_en", vencimientoPendientes),
    ]);
    if ((ultimaHora || 0) >= MAX_POR_HORA_POR_VISITANTE) {
      return error("Hiciste muchas reservas seguidas. Probá de nuevo en un rato.", 429);
    }
    if ((sinPagar || 0) >= MAX_SIN_PAGAR_POR_VISITANTE) {
      return error("Ya tenés reservas esperando el pago de la seña. Terminá esas o esperá unos minutos.", 429);
    }

    // ---- Negocio, servicio, profesional, sucursal ----
    const { data: negocio } = await supabaseAdmin
      .from("negocios")
      .select("id, dias_atencion, horarios_por_dia, horario_apertura, horario_cierre, tipo_sena, porcentaje_o_monto_sena")
      .eq("id", negocioId)
      .maybeSingle();
    if (!negocio) return error("No encontramos este negocio.", 404);

    const { data: servicio } = await supabaseAdmin
      .from("servicios")
      .select("id, precio, duracion_minutos, servicios_profesionales(profesional_id)")
      .eq("id", servicioId)
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (!servicio) return error("Ese servicio ya no está disponible.", 404);

    const vinculados = (servicio.servicios_profesionales || []).map((v) => v.profesional_id);
    if (profesionalId) {
      if (!vinculados.includes(profesionalId)) return error("Esa profesional no hace este servicio.");
    } else if (vinculados.length > 0) {
      return error("Elegí con quién querés atenderte.");
    }

    if (sucursalId) {
      const { data: sucursal } = await supabaseAdmin
        .from("sucursales")
        .select("id")
        .eq("id", sucursalId)
        .eq("negocio_id", negocioId)
        .maybeSingle();
      if (!sucursal) return error("Esa sucursal no existe.");
    }

    // ---- Día ----
    if (fecha <= hoyEnArgentina() || fecha > hoyEnArgentina(DIAS_MAXIMOS_ADELANTE)) {
      return error("Ese día no se puede reservar. Elegí otro.");
    }
    const horario = horarioDelDia(negocio, fecha);
    if (!horario) return error("Ese día el local no atiende. Elegí otro.");

    const [{ data: cierres }, { data: ausencia }] = await Promise.all([
      supabaseAdmin.from("cierres_negocio").select("desde, hasta").eq("negocio_id", negocioId).lte("desde", fecha).gte("hasta", fecha),
      profesionalId
        ? supabaseAdmin.from("ausencias_profesionales").select("id").eq("profesional_id", profesionalId).eq("fecha", fecha).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (fechaCerrada(fecha, cierres)) return error("Ese día el local está cerrado. Elegí otro.");
    if (ausencia) return error("Ese día la profesional no atiende. Elegí otro.");

    // ---- Horario ----
    const duracion = servicio.duracion_minutos;
    if (!generarHorariosInicio(horario.desde, horario.hasta, duracion).includes(hora)) {
      return error("Ese horario no está disponible. Elegí otro.");
    }

    let consultaOcupados = supabaseAdmin
      .from("reservas")
      .select("hora, duracion_minutos, estado, creado_en")
      .eq("negocio_id", negocioId)
      .eq("fecha", fecha)
      .neq("estado", "cancelada");
    consultaOcupados = profesionalId
      ? consultaOcupados.eq("profesional_id", profesionalId)
      : consultaOcupados.is("profesional_id", null);
    const { data: ocupados } = await consultaOcupados;

    const inicio = minutosDe(hora);
    const choca = (ocupados || []).some((r) => {
      if (r.estado === "pendiente_pago" && new Date(r.creado_en) < new Date(vencimientoPendientes)) return false; // ya liberado
      const ri = minutosDe(r.hora);
      return inicio < ri + r.duracion_minutos && ri < inicio + duracion;
    });
    if (choca) return error("Ese horario se acaba de ocupar. Elegí otro.", 409);

    // ---- Guardar ----
    const reservaId = crypto.randomUUID();
    const montoSena = calcularMontoSena(negocio, servicio);
    const { error: errorInsert } = await supabaseAdmin.from("reservas").insert({
      id: reservaId,
      negocio_id: negocioId,
      sucursal_id: sucursalId,
      servicio_id: servicioId,
      profesional_id: profesionalId,
      nombre_cliente: nombre,
      telefono_cliente: telefono,
      email_cliente: email,
      fecha,
      hora,
      duracion_minutos: duracion,
      estado: "pendiente_pago",
      monto_sena: montoSena,
      origen,
    });

    if (errorInsert) {
      console.error("Error guardando la reserva:", errorInsert);
      return error("No pudimos guardar tu reserva. Probá de nuevo en unos segundos.", 500);
    }

    return NextResponse.json({ reservaId, montoSena });
  } catch (err) {
    console.error("Error en /api/reservar:", err);
    return error("No pudimos guardar tu reserva. Probá de nuevo en unos segundos.", 500);
  }
}
