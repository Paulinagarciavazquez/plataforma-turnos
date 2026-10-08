// Mail de comprobante para el cliente, con el diseño a medida del piloto
// "by olivia" (unas-test) — la versión "mail" de SkinPilotoByOlivia.js.
// Misma paleta (burgundy / berry / taupe / almond) y el mismo tono.
//
// Los mails no pueden usar CSS como una web: todo va con estilos en línea y
// tablas, y las tipografías de Google solo se ven en algunos programas de
// mail (Apple Mail, iPhone). En el resto (Gmail, Outlook) caen a Georgia /
// Helvetica, que se eligieron como respaldo para que se vea parecido.
//
// Para un cliente nuevo con diseño propio: copiar este archivo como
// comprobante<Cliente>.js, cambiar el diseño, y sumarlo en
// comprobanteCliente.js — nunca editar este (es el del piloto).

const C = {
  burgundy: "#890620",
  berry: "#B6465F",
  taupe: "#DA9F93",
  almond: "#EBD4CB",
  cream: "#FBF6F3",
  ink: "#2B1116",
};

const SERIF = "'Italiana', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Jost', Helvetica, Arial, sans-serif";

function fila(etiqueta, valor, extra = "") {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${C.almond};font-family:${SANS};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.berry};vertical-align:top;width:38%;">${etiqueta}</td>
      <td style="padding:12px 0;border-bottom:1px solid ${C.almond};font-family:${SANS};font-size:15px;color:${C.ink};text-align:right;vertical-align:top;">${valor}${extra}</td>
    </tr>`;
}

export function comprobanteByOlivia(d) {
  const asunto = `Tu turno en ${d.nombreNegocioPlano} está confirmado ✓`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Italiana&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<title>${asunto}</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
  <div style="display:none;max-height:0;overflow:hidden;">${d.servicio} · ${d.fecha} · ${d.horario}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">

        <!-- Encabezado con el degradado de la marca -->
        <tr><td align="center" style="background-color:${C.burgundy};background-image:linear-gradient(135deg, ${C.burgundy} 0%, ${C.berry} 45%, ${C.taupe} 80%, ${C.almond} 100%);padding:40px 28px 36px;">
          <div style="font-family:${SERIF};font-size:30px;color:${C.cream};letter-spacing:1px;">${d.nombreNegocio}</div>
          <div style="width:44px;height:44px;line-height:44px;margin:22px auto 16px;border-radius:50%;border:1.5px solid ${C.cream};font-family:${SANS};font-size:22px;color:${C.cream};">✓</div>
          <div style="font-family:${SERIF};font-size:26px;color:${C.cream};">¡Tu turno está confirmado!</div>
          <div style="font-family:${SANS};font-size:15px;color:${C.cream};opacity:.9;margin-top:8px;">${d.nombreCliente ? `Hola ${d.nombreCliente}, ` : ""}guardamos tu lugar.</div>
        </td></tr>

        <!-- Resumen del turno -->
        <tr><td style="padding:26px 28px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila("Servicio", d.servicio)}
            ${d.profesional ? fila("Con", d.profesional) : ""}
            ${fila("Día", d.fecha)}
            ${fila("Horario", d.horario)}
            ${d.sucursal ? fila("Dónde", d.sucursal, d.direccion ? `<br><span style="font-size:13px;color:${C.berry};">${d.direccion}</span>` : "") : ""}
          </table>
        </td></tr>

        <!-- Seña -->
        <tr><td style="padding:14px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:14px;">
            <tr>
              <td style="padding:16px 18px;font-family:${SERIF};font-size:17px;color:${C.ink};">Seña ${d.esDemo ? "(simulada)" : "pagada"}</td>
              <td style="padding:16px 18px;font-family:${SERIF};font-size:24px;color:${C.burgundy};text-align:right;">${d.sena}</td>
            </tr>
            ${d.saldo ? `
            <tr>
              <td colspan="2" style="padding:0 18px 16px;font-family:${SANS};font-size:13px;color:${C.berry};">El resto (${d.saldo}) lo abonás en el salón.</td>
            </tr>` : ""}
          </table>
        </td></tr>

        <!-- Cierre -->
        <tr><td style="padding:22px 28px 30px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.ink};">
          <p style="margin:0 0 10px;">Te pedimos llegar 5 minutos antes.</p>
          ${d.puedeResponder ? `<p style="margin:0;">¿Necesitás cambiar o cancelar el turno? Respondé este mail y te ayudamos.</p>` : ""}
          <p style="margin:18px 0 0;font-family:${SERIF};font-size:20px;color:${C.burgundy};">¡Te esperamos!</p>
        </td></tr>

        ${d.esDemo ? `
        <tr><td style="padding:14px 28px;background:${C.almond};font-family:${SANS};font-size:12px;color:${C.ink};text-align:center;">
          Este es un mail de demostración: no se cobró dinero real.
        </td></tr>` : ""}

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { asunto, html };
}
