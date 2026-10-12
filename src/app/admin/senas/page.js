"use client";

import AdminShell from "../AdminShell";
import Senas from "./Senas";

export default function PaginaAdminSenas() {
  return <AdminShell sinTarjeta>{(negocio) => <Senas negocio={negocio} />}</AdminShell>;
}
