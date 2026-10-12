"use client";

import AdminShell from "../AdminShell";
import HorariosYBloqueos from "./HorariosYBloqueos";

export default function PaginaAdminHorarios() {
  return (
    <AdminShell sinTarjeta>
      {(negocio, actualizarNegocio) => <HorariosYBloqueos negocio={negocio} actualizarNegocio={actualizarNegocio} />}
    </AdminShell>
  );
}
