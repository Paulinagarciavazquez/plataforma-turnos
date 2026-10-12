"use client";

import AdminShell from "./AdminShell";
import Agenda from "./Agenda";

export default function PaginaAdminAgenda() {
  return <AdminShell sinTarjeta>{(negocio) => <Agenda negocio={negocio} />}</AdminShell>;
}
