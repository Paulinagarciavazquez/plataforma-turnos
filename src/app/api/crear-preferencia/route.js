import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Crea una preferencia de pago en Mercado Pago para la seña de una reserva
// y devuelve el link de checkout al que hay que redirigir al cliente.
//
// El access token NUNCA sale de acá: se busca en "negocios_pagos" (tabla
// sin lectura pública) usando la Service Role Key, y se usa server-side
// para inicializar el SDK de Mercado Pago. El cliente (navegador) nunca lo
// ve, solo recibe de vuelta la URL de checkout.
export async function POST(request) {
  try {
    const { negocioId, reservaId, monto, descripcion, slug, origin } = await request.json();

    if (!negocioId || !reservaId || !monto || !slug || !origin) {
      return NextResponse.json({ error: "Faltan datos para iniciar el pago." }, { status: 400 });
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
            title: descripcion || "Seña de turno",
            quantity: 1,
            unit_price: Number(monto),
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
