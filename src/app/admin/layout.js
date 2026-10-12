import { Instrument_Serif, Italiana, Schibsted_Grotesk } from "next/font/google";

// Tipografías del panel (las mismas de la landing de Agenda Estudio): una
// base común para todos los negocios. Italiana es la tipografía de marca
// del piloto "by olivia" (ver FUENTE_MARCA en AdminShell.js).
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-panel",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-titulo",
});

const italiana = Italiana({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marca-italiana",
});

export const metadata = {
  title: "Panel del negocio",
};

export default function AdminLayout({ children }) {
  return (
    <div className={`${schibsted.variable} ${instrumentSerif.variable} ${italiana.variable} flex-1`}>
      {children}
    </div>
  );
}
