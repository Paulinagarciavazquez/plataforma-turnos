"use client";

import AdminShell from "../AdminShell";
import GestionSucursales from "./GestionSucursales";

export default function PaginaAdminSucursales() {
  return (
    <AdminShell>
      {(negocio) => <GestionSucursales negocio={negocio} />}
    </AdminShell>
  );
}
