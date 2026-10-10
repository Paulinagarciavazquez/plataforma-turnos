// Cuánto tiempo una reserva "pendiente_pago" le guarda el horario al cliente
// mientras paga la seña. Pasado este tiempo, el horario vuelve a ofrecerse
// online y Mercado Pago ya no acepta el pago (la preferencia vence).
//
// IMPORTANTE: el mismo número está escrito en la vista "turnos_ocupados" de
// Supabase (claude/schema-supabase.sql). Si se cambia acá, cambiarlo allá.
export const MINUTOS_PARA_PAGAR = 30;

// Monto de la seña según la configuración del negocio (porcentaje del
// precio del servicio, o monto fijo). Lo usan el flujo de reserva (para
// mostrarlo) y el servidor al cobrar (que nunca confía en el monto que
// manda el navegador).
export function calcularMontoSena(negocio, servicio) {
  if (!negocio || !servicio) return 0;
  const precioServicio = Number(servicio.precio) || 0;
  const valorSena = Number(negocio.porcentaje_o_monto_sena) || 0;

  if (negocio.tipo_sena === "monto_fijo") {
    return valorSena;
  }
  // Por defecto (o tipo_sena === "porcentaje"), tratamos el valor como %
  return Math.round((precioServicio * valorSena) / 100);
}

// Momento hasta el que se puede pagar la seña de una reserva (Date).
export function venceElPago(reserva) {
  return new Date(new Date(reserva.creado_en).getTime() + MINUTOS_PARA_PAGAR * 60 * 1000);
}

// true si la reserva quedó sin pagar y ya liberó su horario.
export function reservaSinPagarVencida(reserva) {
  return reserva.estado === "pendiente_pago" && venceElPago(reserva) < new Date();
}
