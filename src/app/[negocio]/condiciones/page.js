import PaginaLegal, { cargarNegocio } from "../PaginaLegal";
import { condicionesDeReserva } from "@/lib/textosLegales";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const negocio = await cargarNegocio((await params).negocio);
  return { title: negocio ? `Condiciones de reserva · ${negocio.nombre}` : "Condiciones de reserva" };
}

export default async function Condiciones({ params }) {
  const { negocio: slug } = await params;
  const negocio = await cargarNegocio(slug);
  return (
    <PaginaLegal
      slug={slug}
      negocio={negocio}
      texto={negocio ? condicionesDeReserva(negocio) : null}
      otra={{ ruta: "privacidad", titulo: "Ver la política de privacidad" }}
    />
  );
}
