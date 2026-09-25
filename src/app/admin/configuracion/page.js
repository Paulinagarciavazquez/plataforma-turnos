"use client";

import AdminShell from "../AdminShell";
import ConfiguracionNegocio from "./ConfiguracionNegocio";

export default function PaginaAdminConfiguracion() {
  return (
    <AdminShell>
      {(negocio, actualizarNegocio) => (
        <ConfiguracionNegocio negocio={negocio} actualizarNegocio={actualizarNegocio} />
      )}
    </AdminShell>
  );
}
