const NOMBRES_DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Formatea una fecha ISO ("YYYY-MM-DD", como la que guarda el flujo de
// reserva) a algo legible tipo "lun 18/09". Vive en un archivo aparte
// (en vez de adentro de page.js) para que tanto el skin genérico como
// cualquier skin a medida (por ejemplo el de "by olivia") lo puedan usar
// sin duplicar la lógica ni generar un import circular entre archivos.
export function formatearFechaCorta(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${NOMBRES_DIA_CORTO[fecha.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

const NOMBRES_DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Versión larga, tipo "jueves 15 de octubre" — pensada para los mails,
// donde hay más lugar que en la pantalla del celular.
export function formatearFechaLarga(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${NOMBRES_DIA_LARGO[fecha.getDay()]} ${d} de ${NOMBRES_MES[m - 1]}`;
}
