"use client";

import AdminShell from "../AdminShell";
import GestionServicios from "./GestionServicios";

export default function PaginaAdminServicios() {
  return (
    <AdminShell>
      {(negocio) => <GestionServicios negocio={negocio} />}
    </AdminShell>
  );
}
