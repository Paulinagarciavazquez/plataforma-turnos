"use client";

import AdminShell from "../AdminShell";
import GestionAusencias from "./GestionAusencias";

export default function PaginaAdminAusencias() {
  return (
    <AdminShell>
      {(negocio) => <GestionAusencias negocio={negocio} />}
    </AdminShell>
  );
}
