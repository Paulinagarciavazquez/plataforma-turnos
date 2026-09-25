import { NextResponse } from "next/server";
import { confirmarPagoDeReserva } from "@/lib/confirmarPago";

// Se llama cuando el cliente vuelve del checkout (back_url) de Mercado Pago.
// Toda la lógica real de verificar y confirmar el pago vive en
// confirmarPagoDeReserva (src/lib/confirmarPago.js), compartida con el
// webhook server-to-server (api/webhooks/mercadopago).
export async function POST(request) {
  try {
    const { reservaId, paymentId } = await request.json();
    const resultado = await confirmarPagoDeReserva({ reservaId, paymentId });
    return NextResponse.json(resultado.body, { status: resultado.status });
  } catch (err) {
    console.error("Error verificando el pago de Mercado Pago:", err);
    return NextResponse.json({ error: "No pudimos verificar tu pago." }, { status: 500 });
  }
}
