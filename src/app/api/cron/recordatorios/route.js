import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CAMPOS_RESERVA, mandarMailCliente } from "@/lib/confirmarPago";

// Tarea diaria (la dispara Vercel Cron, ver vercel.json): le manda a cada
// cliente con turno confirmado para MAÑANA un mail de recordatorio, con el
// diseño de su negocio. Corre una vez por día a la mañana (hora argentina),
// así que el recordatorio llega "el día anterior", no exactamente 24 h antes.
//
// Seguridad: Vercel manda el header "Authorization: Bearer <CRON_SECRET>"
// cuando la variable CRON_SECRET está cargada en el proyecto. Sin esa
// variable la ruta no hace nada, para que nadie pueda dispararla desde afuera.

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

// Resend (plan gratis) acepta como máximo 2 mails por segundo.
const PAUSA_ENTRE_MAILS_MS = 600;

// Fecha de mañana en Argentina, como "YYYY-MM-DD" (el servidor de Vercel
// corre en hora UTC, por eso no alcanza con new Date() a secas).
function fechaDeMananaEnArgentina() {
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(manana);
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const fecha = fechaDeMananaEnArgentina();

  const { data: reservas, error } = await supabaseAdmin
    .from("reservas")
    .select(CAMPOS_RESERVA)
    .eq("fecha", fecha)
    .eq("estado", "confirmada")
    .eq("bloqueo_manual", false)
    .not("email_cliente", "is", null)
    .is("recordatorio_enviado_en", null);

  if (error) {
    console.error("Error buscando turnos para recordar:", error);
    return NextResponse.json({ error: "No pudimos leer las reservas." }, { status: 500 });
  }

  let enviados = 0;
  for (const reserva of reservas) {
    // Primero "reservamos" el envío marcando la fila (solo si sigue sin
    // marcar). Si por algún motivo la tarea corre dos veces a la vez, la
    // segunda no encuentra la fila libre y no manda el mail repetido.
    const { data: marcada } = await supabaseAdmin
      .from("reservas")
      .update({ recordatorio_enviado_en: new Date().toISOString() })
      .eq("id", reserva.id)
      .is("recordatorio_enviado_en", null)
      .select("id");

    if (!marcada?.length) continue;

    const ok = await mandarMailCliente(reserva, "recordatorio");
    if (ok) {
      enviados++;
    } else {
      // No salió: liberamos la marca para que se pueda reintentar.
      await supabaseAdmin.from("reservas").update({ recordatorio_enviado_en: null }).eq("id", reserva.id);
    }

    await esperar(PAUSA_ENTRE_MAILS_MS);
  }

  console.log(`Recordatorios para ${fecha}: ${enviados} de ${reservas.length} enviados.`);
  return NextResponse.json({ fecha, turnos: reservas.length, enviados });
}
