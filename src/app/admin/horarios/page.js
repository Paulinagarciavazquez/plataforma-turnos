"use client";

import AdminShell from "../AdminShell";
import GestionAusencias from "../ausencias/GestionAusencias";

// "Horarios y bloqueos" reúne en una sola pantalla el horario de atención,
// los cierres del local y las ausencias del equipo (paso 4 del rediseño del
// panel). Por ahora muestra la carga de ausencias de siempre.
export default function PaginaAdminHorarios() {
  return <AdminShell>{(negocio) => <GestionAusencias negocio={negocio} />}</AdminShell>;
}
