import PaginaLegal, { cargarNegocio } from "../PaginaLegal";
import { politicaDePrivacidad } from "@/lib/textosLegales";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const negocio = await cargarNegocio((await params).negocio);
  return { title: negocio ? `Política de privacidad · ${negocio.nombre}` : "Política de privacidad" };
}

export default async function Privacidad({ params }) {
  const { negocio: slug } = await params;
  const negocio = await cargarNegocio(slug);
  return (
    <PaginaLegal
      slug={slug}
      negocio={negocio}
      texto={negocio ? politicaDePrivacidad(negocio) : null}
      otra={{ ruta: "condiciones", titulo: "Ver las condiciones de reserva" }}
    />
  );
}
