"use client";

import AdminShell from "./AdminShell";
import ListaReservas from "./ListaReservas";

export default function PaginaAdminReservas() {
  return <AdminShell>{(negocio) => <ListaReservas negocio={negocio} />}</AdminShell>;
}
