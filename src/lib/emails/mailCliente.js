import { datosDelTurno } from "@/lib/emails/datosDelTurno";
import { mailClienteByOlivia } from "@/lib/emails/mailClienteByOlivia";

// Mismo patrón que las "pieles" del flujo de reserva (ver page.js): cada
// negocio con diseño a medida tiene su propia plantilla de mail, elegida por
// slug. Los negocios sin plantilla propia reciben la genérica de abajo, que
// usa los colores cargados en el panel. Cada plantilla arma los dos mails
// que recibe el cliente: "comprobante" (al confirmarse el turno) y
// "recordatorio" (el día anterior).
const PLANTILLAS_A_MEDIDA = {
  "unas-test": mailClienteByOlivia,
};

const COLOR_POR_DEFECTO = "#7c3aed";

function colorSeguro(color) {
  return /^#[0-9a-fA-F]{3,8}$/.test(color || "") ? color : COLOR_POR_DEFECTO;
}

function mailClienteGenerico(d, tipo, reserva) {
  const color = colorSeguro(reserva.negocios?.color_primario);
  const esRecordatorio = tipo === "recordatorio";
  const asunto = esRecordatorio
    ? `Te esperamos mañana a las ${d.horaInicio} · ${d.nombreNegocioPlano}`
    : `Tu turno en ${d.nombreNegocioPlano} está confirmado`;
  const titulo = esRecordatorio ? "¡Te esperamos mañana!" : "¡Tu turno está confirmado!";
  const saludo = esRecordatorio ? "te recordamos tu turno." : "guardamos tu lugar.";
  const fila = (etiqueta, valor) =>
    `<tr><td style="padding:8px 0;color:#666;">${etiqueta}</td><td style="padding:8px 0;text-align:right;color:#222;">${valor}</td></tr>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${d.nombreNegocio}</title></head>
<body style="margin:0;padding:24px 12px;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;">
    <tr><td style="background:${color};padding:28px;text-align:center;color:#fff;">
      <div style="font-size:14px;opacity:.9;">${d.nombreNegocio}</div>
      <div style="font-size:22px;font-weight:bold;margin-top:8px;">${titulo}</div>
    </td></tr>
    <tr><td style="padding:24px 28px;font-size:15px;">
      ${d.nombreCliente ? `<p style="margin:0 0 14px;">Hola ${d.nombreCliente}, ${saludo}</p>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fila("Servicio", d.servicio)}
        ${d.profesional ? fila("Profesional", d.profesional) : ""}
        ${fila("Día", d.fecha)}
        ${fila("Horario", d.horario)}
        ${d.sucursal ? fila("Sucursal", d.direccion ? `${d.sucursal}<br><small>${d.direccion}</small>` : d.sucursal) : ""}
        ${fila(d.esDemo ? "Seña (simulada)" : "Seña pagada", `<strong>${d.sena}</strong>`)}
        ${d.saldo ? fila("A pagar en el local", d.saldo) : ""}
      </table>
      ${d.puedeResponder ? `<p style="margin:18px 0 0;color:#666;font-size:13px;">¿Necesitás cambiar o cancelar el turno? Respondé este mail.</p>` : ""}
      ${d.esDemo ? `<p style="margin:18px 0 0;color:#999;font-size:12px;">Mail de demostración: no se cobró dinero real.</p>` : ""}
    </td></tr>
  </table>
</body></html>`;

  return { asunto, html };
}

// Devuelve { asunto, html } del mail para el cliente de esta reserva.
// tipo: "comprobante" | "recordatorio"
export function armarMailCliente(reserva, tipo) {
  const d = datosDelTurno(reserva);
  const plantilla = PLANTILLAS_A_MEDIDA[reserva.negocios?.slug];
  return plantilla ? plantilla(d, tipo) : mailClienteGenerico(d, tipo, reserva);
}
