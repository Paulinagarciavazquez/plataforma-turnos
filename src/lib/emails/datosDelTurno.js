import { formatearFechaLarga } from "@/lib/formatearFecha";
import { horaFin } from "@/lib/horarios";

// Escapa los caracteres especiales de HTML. Imprescindible para todo lo que
// carga el cliente a mano (nombre, teléfono): si no, alguien podría meter
// HTML propio adentro de un mail que manda la plataforma.
export function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatearPrecio(precio) {
  return `$${Number(precio || 0).toLocaleString("es-AR")}`;
}

// Arma, a partir de una reserva leída de Supabase (con sus relaciones),
// todos los textos que necesita cualquier plantilla de mail — ya
// formateados y escapados. Así cada plantilla (genérica o a medida de un
// negocio) solo se ocupa del diseño, no de calcular fechas ni precios.
export function datosDelTurno(reserva) {
  const horaInicio = (reserva.hora || "").slice(0, 5);
  const precio = Number(reserva.servicios?.precio || 0);
  const sena = Number(reserva.monto_sena || 0);

  return {
    nombreNegocio: escaparHtml(reserva.negocios?.nombre || ""),
    // Sin escapar: solo para el asunto del mail, que es texto plano (no HTML)
    nombreNegocioPlano: reserva.negocios?.nombre || "",
    nombreCliente: escaparHtml((reserva.nombre_cliente || "").trim().split(" ")[0]),
    servicio: escaparHtml(reserva.servicios?.nombre || "-"),
    profesional: reserva.profesionales ? escaparHtml(reserva.profesionales.nombre) : null,
    sucursal: reserva.sucursales ? escaparHtml(reserva.sucursales.nombre) : null,
    direccion: reserva.sucursales?.direccion ? escaparHtml(reserva.sucursales.direccion) : null,
    fecha: formatearFechaLarga(reserva.fecha),
    horario: reserva.duracion_minutos
      ? `${horaInicio} a ${horaFin(horaInicio, reserva.duracion_minutos)} h`
      : `${horaInicio} h`,
    sena: formatearPrecio(sena),
    // Lo que queda por pagar en el local (solo si el servicio sale más que la seña)
    saldo: precio > sena ? formatearPrecio(precio - sena) : null,
    esDemo: Boolean(reserva.negocios?.modo_demo),
    // Si el negocio cargó un email de avisos, el cliente puede responder el
    // mail directamente (se usa como reply-to).
    puedeResponder: Boolean(reserva.negocios?.email_notificaciones),
  };
}
