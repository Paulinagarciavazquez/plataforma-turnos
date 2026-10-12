/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cabeceras de seguridad para todas las páginas:
  // - nadie puede mostrar la web ni el panel adentro de otra página (evita
  //   engaños por clics sobre una página camuflada, "clickjacking");
  // - el navegador no adivina tipos de archivo;
  // - al salir hacia otro sitio solo se comparte el dominio, no la URL entera
  //   (que puede traer ?reserva=...).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
