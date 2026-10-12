"use client";

import AdminShell from "../AdminShell";

// Paso 3 del rediseño del panel: resumen de señas cobradas y reservas sin
// pagar. Por ahora solo ocupa su lugar en el menú.
export default function PaginaAdminSenas() {
  return (
    <AdminShell>
      {() => (
        <p className="text-[#3B3532]">
          Muy pronto vas a ver acá cuánto cobraste en señas y qué reservas quedaron sin pagar.
        </p>
      )}
    </AdminShell>
  );
}
