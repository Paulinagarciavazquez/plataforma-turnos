// Marca de cada negocio dentro del panel de administración: el diseño base
// es común (Agenda Estudio) y se tiñe con el color principal del negocio.

const COLOR_POR_DEFECTO = "#1E1B1A";

// Color principal del negocio, solo si es un hex de 6 dígitos (así se le
// pueden sumar 2 dígitos de transparencia, ej. color + "1F").
export function colorDeMarca(negocio) {
  return /^#[0-9a-fA-F]{6}$/.test(negocio?.color_primario || "") ? negocio.color_primario : COLOR_POR_DEFECTO;
}

// Tipografía del nombre del negocio. Instrument Serif por defecto; un negocio
// con diseño a medida puede tener la suya (mismo patrón por slug que las
// pieles del flujo de reserva). Las variables las define src/app/admin/layout.js.
const FUENTE_MARCA = {
  "unas-test": "var(--font-marca-italiana)",
};

export function fuenteDeMarca(negocio) {
  return FUENTE_MARCA[negocio?.slug] || "var(--font-titulo)";
}
