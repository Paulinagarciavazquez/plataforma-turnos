import { NextResponse } from "next/server";
import { confirmarReservaDemo } from "@/lib/confirmarPago";

// Ruta usada solo por negocios en "modo demo" (ver src/lib/confirmarPago.js
// para el detalle de seguridad): confirma la reserva al toque, sin llamar a
// Mercado Pago, para que el piloto se pueda chusmear de punta a punta sin
// necesitar una cuenta de prueba.
export async function POST(request) {
  try {
    const { reservaId } = await request.json();
    const resultado = await confirmarReservaDemo({ reservaId });
    return NextResponse.json(resultado.body, { status: resultado.status });
  } catch (err) {
    console.error("Error simulando pago demo:", err);
    return NextResponse.json({ error: "No pudimos simular el pago." }, { status: 500 });
  }
}
