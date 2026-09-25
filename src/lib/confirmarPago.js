import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function formatearPrecio(precio) {
  return `$${Number(precio || 0).toLocaleString("es-AR")}`;
}

// Le avisa por email a la dueña del negocio que se confirmó (y pagó) un
// turno nuevo. Nunca rompe la confirmación del pago si falla: es un aviso,
// no una condición para que la reserva quede confirmada.
async function avisarNuevoTurno(reserva) {
  const emailDestino = reserva.negocios?.email_notificaciones;
  if (!resend || !emailDestino) return;

  try {
    await resend.emails.send({
      from: "Turnos <onboarding@resend.dev>",
      to: [emailDestino],
      subject: `Nuevo turno confirmado: ${reserva.servicios?.nombre || "servicio"} - ${reserva.fecha}`,
      html: `
        <h2>¡Tenés un turno nuevo confirmado!</h2>
        <p><strong>Servicio:</strong> ${reserva.servicios?.nombre || "-"}</p>
        ${reserva.sucursales ? `<p><strong>Sucursal:</strong> ${reserva.sucursales.nombre}</p>` : ""}
        ${reserva.profesionales ? `<p><strong>Profesional:</strong> ${reserva.profesionales.nombre}</p>` : ""}
        <p><strong>Día y horario:</strong> ${reserva.fecha} · ${reserva.hora}</p>
        <p><strong>Seña pagada:</strong> ${formatearPrecio(reserva.monto_sena)}</p>
        <hr />
        <p><strong>Cliente:</strong> ${reserva.nombre_cliente}</p>
        <p><strong>Teléfono:</strong> ${reserva.telefono_cliente || "-"}</p>
      `,
    });
  } catch (errorEmail) {
    console.error("Error mandando el email de aviso de turno:", errorEmail);
  }
}

// Verifica, del lado del servidor, si el pago de una reserva se acreditó de
// verdad en Mercado Pago, y si corresponde confirma la reserva y dispara el
// aviso por email. NUNCA confía en los datos que le pasan por sí solos:
// siempre se consulta a la API de pagos de Mercado Pago con el token del
// negocio dueño de la reserva.
//
// Es el único lugar que decide si un pago confirma una reserva — lo usan
// tanto la pantalla de vuelta del checkout (api/verificar-pago) como el
// webhook server-to-server (api/webhooks/mercadopago), para que las dos
// vías lleguen siempre al mismo resultado.
export async function confirmarPagoDeReserva({ reservaId, paymentId }) {
  if (!reservaId) {
    return { status: 400, body: { error: "Falta el identificador de la reserva." } };
  }

  const { data: reserva, error: errorReserva } = await supabaseAdmin
    .from("reservas")
    .select(
      "id, negocio_id, fecha, hora, monto_sena, estado, nombre_cliente, telefono_cliente, servicios(nombre), sucursales(nombre), profesionales(nombre), negocios(nombre, email_notificaciones)"
    )
    .eq("id", reservaId)
    .maybeSingle();

  if (errorReserva) {
    console.error("Error leyendo la reserva:", errorReserva);
    return { status: 500, body: { error: "No pudimos verificar tu pago." } };
  }

  if (!reserva) {
    return { status: 404, body: { error: "No encontramos esa reserva." } };
  }

  const resumenBase = {
    negocioId: reserva.negocio_id,
    reservaId: reserva.id,
    servicio: reserva.servicios,
    sucursal: reserva.sucursales,
    profesional: reserva.profesionales,
    fecha: reserva.fecha,
    hora: reserva.hora,
    montoSena: reserva.monto_sena,
    nombreNegocio: reserva.negocios?.nombre,
  };

  // Si ya estaba confirmada (por ejemplo, el cliente recargó esta misma
  // pantalla, o el webhook llega después de que la vuelta del checkout ya
  // la confirmó), no hace falta volver a consultar a Mercado Pago ni
  // reenviar el mail.
  if (reserva.estado === "confirmada") {
    return { status: 200, body: { ...resumenBase, estadoPago: "aprobado" } };
  }

  if (!paymentId) {
    return { status: 200, body: { ...resumenBase, estadoPago: "sin_pago" } };
  }

  const { data: pago, error: errorPago } = await supabaseAdmin
    .from("negocios_pagos")
    .select("mercadopago_access_token")
    .eq("negocio_id", reserva.negocio_id)
    .maybeSingle();

  if (errorPago || !pago?.mercadopago_access_token) {
    console.error("Error leyendo negocios_pagos:", errorPago);
    return {
      status: 200,
      body: { ...resumenBase, estadoPago: "error", error: "Este negocio no tiene el cobro online configurado." },
    };
  }

  const client = new MercadoPagoConfig({ accessToken: pago.mercadopago_access_token });
  const pagoMp = await new Payment(client).get({ id: paymentId });

  // Chequeo de seguridad: el pago que estamos mirando tiene que corresponder
  // a esta reserva (lo guardamos como external_reference al crear la preferencia).
  if (pagoMp.external_reference && pagoMp.external_reference !== reservaId) {
    return {
      status: 200,
      body: { ...resumenBase, estadoPago: "error", error: "El pago no corresponde a esta reserva." },
    };
  }

  let nuevoEstado = reserva.estado;
  let estadoPago = "pendiente";

  if (pagoMp.status === "approved") {
    nuevoEstado = "confirmada";
    estadoPago = "aprobado";
  } else if (pagoMp.status === "rejected") {
    estadoPago = "rechazado";
    // No cancelamos la reserva automáticamente: queda pendiente_pago para
    // que el cliente pueda reintentar el pago sin perder el horario.
  } else {
    // in_process, pending, etc.
    estadoPago = "pendiente";
  }

  const cambios = { id_pago_mercadopago: String(paymentId) };
  if (nuevoEstado !== reserva.estado) {
    cambios.estado = nuevoEstado;
  }

  const { error: errorUpdate } = await supabaseAdmin
    .from("reservas")
    .update(cambios)
    .eq("id", reservaId);

  if (errorUpdate) {
    console.error("Error actualizando la reserva tras el pago:", errorUpdate);
  }

  if (nuevoEstado === "confirmada" && reserva.estado !== "confirmada") {
    await avisarNuevoTurno(reserva);
  }

  return { status: 200, body: { ...resumenBase, estadoPago } };
}
