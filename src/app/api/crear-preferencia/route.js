import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcularMontoSena, venceElPago } from "@/lib/reservas";

// Crea una preferencia de pago en Mercado Pago para la seña de una reserva
// y devuelve el link de checkout al que hay que redirigir al cliente.
//
// El access token NUNCA sale de acá: se busca en "negocios_pagos" (tabla
// sin lectura pública) usando la Service Role Key, y se usa server-side
// para inicializar el SDK de Mercado Pago. El cliente (navegador) nunca lo
// ve, solo recibe de vuelta la URL de checkout.
export async function POST(request) {
  try {
    const { negocioId, reservaId, slug, origin } = await request.json();

    if (!negocioId || !reservaId || !slug || !origin) {
      return NextResponse.json({ error: "Faltan datos para iniciar el pago." }, { status: 400 });
    }

    // El monto de la seña se recalcula SIEMPRE acá, con el precio del
    // servicio y la configuración del negocio guardados en la base: nunca se
    // confía en lo que manda el navegador (ni en el monto_sena que guardó al
    // reservar), que alguien podría modificar para pagar una seña de $1.
    const { data: reserva, error: errorReserva } = await supabaseAdmin
      .from("reservas")
      .select(
        "id, negocio_id, estado, monto_sena, creado_en, bloqueo_manual, servicios(nombre, precio), negocios(tipo_sena, porcentaje_o_monto_sena)"
      )
      .eq("id", reservaId)
      .maybeSingle();

    if (errorReserva) {
      console.error("Error leyendo la reserva para el pago:", errorReserva);
      return NextResponse.json({ error: "No pudimos iniciar el pago. Probá de nuevo." }, { status: 500 });
    }

    if (!reserva || reserva.negocio_id !== negocioId || reserva.bloqueo_manual || !reserva.servicios) {
      return NextResponse.json({ error: "No encontramos esa reserva." }, { status: 404 });
    }

    const montoSena = calcularMontoSena(reserva.negocios, reserva.servicios);
    if (!(montoSena > 0)) {
      return NextResponse.json({ error: "Este negocio no tiene una seña configurada." }, { status: 400 });
    }

    // Si el monto guardado no coincide con el real, lo corregimos para que
    // el panel y los mails muestren lo que de verdad se cobra.
    if (Number(reserva.monto_sena) !== montoSena) {
      await supabaseAdmin.from("reservas").update({ monto_sena: montoSena }).eq("id", reservaId);
    }

    if (reserva.estado !== "pendiente_pago") {
      return NextResponse.json({ error: "Esta reserva ya no está esperando un pago." }, { status: 409 });
    }

    // Pasados MINUTOS_PARA_PAGAR, el horario ya se liberó para otros clientes
    // (ver src/lib/reservas.js): no dejamos pagar una reserva vencida.
    const vencimiento = venceElPago(reserva);
    if (vencimiento < new Date()) {
      return NextResponse.json(
        { error: "Pasó el tiempo para pagar la seña y el horario se liberó. Hacé la reserva de nuevo." },
        { status: 409 }
      );
    }

    const { data: pago, error: errorPago } = await supabaseAdmin
      .from("negocios_pagos")
      .select("mercadopago_access_token")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (errorPago) {
      console.error("Error leyendo negocios_pagos:", errorPago);
      return NextResponse.json({ error: "No pudimos iniciar el pago. Probá de nuevo." }, { status: 500 });
    }

    if (!pago?.mercadopago_access_token) {
      return NextResponse.json(
        { error: "Este negocio todavía no configuró el cobro online." },
        { status: 400 }
      );
    }

    const client = new MercadoPagoConfig({ accessToken: pago.mercadopago_access_token });
    const preference = new Preference(client);

    const respuesta = await preference.create({
      body: {
        items: [
          {
            title: `Seña - ${reserva.servicios?.nombre || "turno"}`,
            quantity: 1,
            unit_price: montoSena,
            currency_id: "ARS",
          },
        ],
        external_reference: reservaId,
        back_urls: {
          success: `${origin}/${slug}?pago=exito&reserva=${reservaId}`,
          failure: `${origin}/${slug}?pago=fallo&reserva=${reservaId}`,
          pending: `${origin}/${slug}?pago=pendiente&reserva=${reservaId}`,
        },
        // Sin esto, Mercado Pago no redirige solo de vuelta al sitio: deja
        // a la clienta en su propia pantalla con un botón "Volver al sitio"
        // para tocar a mano. auto_return exige que back_urls sean https,
        // por eso no daba error en local (localhost es http) pero tampoco
        // redirigía -- ahora que estamos en un dominio https real, funciona.
        auto_return: "approved",
        // El link de pago vence junto con la reserva: después de eso Mercado
        // Pago no acepta el pago (el horario ya puede ser de otra persona).
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: vencimiento.toISOString(),
        // Sin medios de pago "en efectivo" (Rapipago, Pago Fácil, etc.): esos
        // se acreditan días después, cuando el horario ya se liberó.
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
        },
      },
    });

    // Con credenciales de prueba (TEST-...), sandbox_init_point es el link
    // correcto para simular el pago; con credenciales reales (APP_USR-...)
    // Mercado Pago solo devuelve init_point.
    const urlCheckout = respuesta.sandbox_init_point || respuesta.init_point;

    if (!urlCheckout) {
      console.error("Mercado Pago no devolvió init_point:", respuesta);
      return NextResponse.json(
        { error: "Mercado Pago no devolvió un link de pago." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: urlCheckout });
  } catch (err) {
    console.error("Error creando preferencia de Mercado Pago:", err);
    return NextResponse.json({ error: "No pudimos iniciar el pago. Probá de nuevo." }, { status: 500 });
  }
}
