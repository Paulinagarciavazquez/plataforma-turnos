import { redirect } from "next/navigation";

// Las ausencias ahora viven en "Horarios y bloqueos". Esta ruta queda solo
// para que un link viejo no dé error.
export default function PaginaAdminAusencias() {
  redirect("/admin/horarios");
}
