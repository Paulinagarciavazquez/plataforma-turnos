import { NextResponse } from "next/server";
import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { confirmarPagoDeReserva } from "@/lib/confirmarPago";

// Notificación server-to-server de Mercado Pago. Además de la verificación
// que se dispara cuando el cliente vuelve del checkout (api/verificar-pago),
// esta ruta es un segundo camino, más confiable, para confirmar un pago:
// no depende de que el navegador del cliente vuelva a pisar la web (puede
// cerrar la pestaña, cortarse la conexión, etc. y el pago igual se acreditó).
//
// La URL a cargar en el panel de Mercado Pago de CADA negocio (Tus
// integraciones > la app de ese negocio > Webhooks > Configurar
// notificaciones) es:
//   https://<dominio>/api/webhooks/mercadopago?negocioId=<id del negocio>
// "negocioId" es un parámetro propio (no de Mercado Pago): como esta misma
// ruta atiende a todos los negocios de la plataforma, así sabemos a cuál
// corresponde cada notificación. Mercado Pago agrega su propio "data.id"
// como parámetro de la URL también, pero eso no lo tocamos nosotros.
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const negocioId = url.searchParams.get("negocioId");

    if (!negocioId) {
      // No sabemos a qué negocio corresponde: no hay nada que hacer, pero
      // respondemos 200 para que Mercado Pago no reintente sin sentido.
      return NextResponse.json({ ok: true, motivo: "sin_negocio_id" });
    }

    const cuerpo = await request.json().catch(() => ({}));
    const tipo = cuerpo?.type || url.searchParams.get("type") || url.searchParams.get("topic");
    const dataId = cuerpo?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");

    if (tipo !== "payment" || !dataId) {
      // Otros tipos de notificación (merchant_order, etc.) no nos interesan.
      return NextResponse.json({ ok: true, motivo: "tipo_ignorado" });
    }

    const { data: pagoConfig, error: errorPagoConfig } = await supabaseAdmin
      .from("negocios_pagos")
      .select("mercadopago_access_token, mercadopago_webhook_secret")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (errorPagoConfig || !pagoConfig?.mercadopago_access_token) {
      console.error("Webhook MP: negocio sin cobro online configurado", negocioId, errorPagoConfig);
      return NextResponse.json({ ok: true, motivo: "negocio_sin_configurar" });
    }

    // Validación de la firma (x-signature): así nos aseguramos de que la
    // notificación realmente viene de Mercado Pago y no de cualquiera que le
    // pegue a esta URL pública.
    if (pagoConfig.mercadopago_webhook_secret) {
      const firmaValida = validarFirmaWebhook({
        xSignature: request.headers.get("x-signature"),
        xRequestId: request.headers.get("x-request-id"),
        dataId,
        secret: pagoConfig.mercadopago_webhook_secret,
      });

      if (!firmaValida) {
        console.error("Webhook MP: firma inválida para negocio", negocioId);
        return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
      }
    } else {
      // Todavía no cargó la clave secreta en el panel: no cortamos la
      // notificación (para no perderla), pero queda sin verificar. Se loguea
      // para poder detectarlo.
      console.warn("Webhook MP: sin clave secreta configurada para el negocio", negocioId, "— firma no verificada.");
    }

    // Buscamos el pago real en Mercado Pago para saber a qué reserva
    // corresponde (external_reference) y confirmar con la misma lógica que
    // usa la vuelta del checkout.
    const client = new MercadoPagoConfig({ accessToken: pagoConfig.mercadopago_access_token });
    const pagoMp = await new Payment(client).get({ id: dataId });
    const reservaId = pagoMp.external_reference;

    if (!reservaId) {
      return NextResponse.json({ ok: true, motivo: "sin_external_reference" });
    }

    const resultado = await confirmarPagoDeReserva({ reservaId, paymentId: dataId });
    return NextResponse.json({ ok: true, resultado: resultado.body });
  } catch (err) {
    console.error("Error procesando webhook de Mercado Pago:", err);
    // Respondemos 200 igual: si el error es nuestro, que Mercado Pago
    // reintente no lo va a arreglar, y no queremos que por eso deje de
    // mandarnos notificaciones a esta URL. El log queda para diagnosticar.
    return NextResponse.json({ ok: false });
  }
}

// Arma el mismo "manifest" que usa Mercado Pago para firmar la notificación
// (id:{data.id};request-id:{x-request-id};ts:{ts};, con el id en minúsculas
// y omitiendo cualquier parte que no esté presente) y lo compara con la
// firma recibida, calculada con HMAC-SHA256 y la clave secreta del webhook
// de ese negocio.
function validarFirmaWebhook({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature) return false;

  const partes = Object.fromEntries(
    xSignature.split(",").map((parte) => {
      const [clave, valor] = parte.split("=");
      return [clave?.trim(), valor?.trim()];
    })
  );

  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const segmentos = [];
  if (dataId) segmentos.push(`id:${String(dataId).toLowerCase()};`);
  if (xRequestId) segmentos.push(`request-id:${xRequestId};`);
  segmentos.push(`ts:${ts};`);

  const manifest = segmentos.join("");
  const calculado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(calculado, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}
