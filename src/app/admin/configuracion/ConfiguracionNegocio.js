"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// El horario de atención se edita en "Horarios y bloqueos"
// (src/app/admin/horarios/HorariosYBloqueos.js), no acá.

const COLOR_POR_DEFECTO_PRIMARIO = "#D9A79C";
const COLOR_POR_DEFECTO_SECUNDARIO = "#3A2E2A";

export default function ConfiguracionNegocio({ negocio, actualizarNegocio }) {
  const [tipoSena, setTipoSena] = useState(negocio.tipo_sena || "porcentaje");
  const [montoSena, setMontoSena] = useState(
    negocio.porcentaje_o_monto_sena ?? ""
  );

  const [textoBienvenida, setTextoBienvenida] = useState(
    negocio.texto_bienvenida || ""
  );
  const [colorPrimario, setColorPrimario] = useState(
    negocio.color_primario || COLOR_POR_DEFECTO_PRIMARIO
  );
  const [colorSecundario, setColorSecundario] = useState(
    negocio.color_secundario || COLOR_POR_DEFECTO_SECUNDARIO
  );
  const [logoUrl, setLogoUrl] = useState(negocio.logo_url || "");
  const [emailNotificaciones, setEmailNotificaciones] = useState(
    negocio.email_notificaciones || ""
  );

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: "exito" | "error", texto }

  const [mercadopagoAccessToken, setMercadopagoAccessToken] = useState("");
  const [tienePagoConfigurado, setTienePagoConfigurado] = useState(false);
  const [cargandoPago, setCargandoPago] = useState(true);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [mensajePago, setMensajePago] = useState(null);

  const [mercadopagoWebhookSecret, setMercadopagoWebhookSecret] = useState("");
  const [tieneWebhookConfigurado, setTieneWebhookConfigurado] = useState(false);
  const [guardandoWebhook, setGuardandoWebhook] = useState(false);
  const [mensajeWebhook, setMensajeWebhook] = useState(null);
  // La URL del webhook depende del dominio desde el que se abre el panel
  // (window.location.origin). Esta pantalla se monta recién con la sesión
  // cargada, siempre en el navegador, así que se puede calcular de entrada.
  const urlWebhook =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/mercadopago?negocioId=${negocio.id}`
      : "";

  // El access token (y la clave del webhook) de Mercado Pago viven en una
  // tabla aparte ("negocios_pagos"), no en "negocios": esa tabla es de
  // lectura pública (la necesita el flujo de reserva anónimo) y nunca debe
  // exponer un dato sensible como este. Acá solo chequeamos si ya hay uno
  // guardado, no lo volvemos a mostrar en pantalla una vez guardado.
  useEffect(() => {
    async function cargarPago() {
      setCargandoPago(true);
      const { data } = await supabase
        .from("negocios_pagos")
        .select("mercadopago_access_token, mercadopago_webhook_secret")
        .eq("negocio_id", negocio.id)
        .maybeSingle();

      setTienePagoConfigurado(Boolean(data?.mercadopago_access_token));
      setTieneWebhookConfigurado(Boolean(data?.mercadopago_webhook_secret));
      setCargandoPago(false);
    }

    cargarPago();
  }, [negocio.id]);

  async function guardarCambios(e) {
    e.preventDefault();

    if (!montoSena) {
      window.alert("Ingresá el monto o porcentaje de la seña.");
      return;
    }
    setGuardando(true);
    setMensaje(null);

    const cambios = {
      tipo_sena: tipoSena,
      porcentaje_o_monto_sena: Number(montoSena),
      texto_bienvenida: textoBienvenida.trim() || null,
      color_primario: colorPrimario,
      color_secundario: colorSecundario,
      logo_url: logoUrl.trim() || null,
      email_notificaciones: emailNotificaciones.trim() || null,
    };

    const { error } = await supabase
      .from("negocios")
      .update(cambios)
      .eq("id", negocio.id);

    setGuardando(false);

    if (error) {
      setMensaje({ tipo: "error", texto: "No pudimos guardar los cambios. Probá de nuevo." });
      return;
    }

    actualizarNegocio((prev) => ({ ...prev, ...cambios }));
    setMensaje({ tipo: "exito", texto: "Cambios guardados." });
  }

  async function guardarMercadoPago(e) {
    e.preventDefault();

    if (!mercadopagoAccessToken.trim()) {
      window.alert("Pegá el access token antes de guardar.");
      return;
    }

    setGuardandoPago(true);
    setMensajePago(null);

    const { error } = await supabase.from("negocios_pagos").upsert({
      negocio_id: negocio.id,
      mercadopago_access_token: mercadopagoAccessToken.trim(),
      actualizado_en: new Date().toISOString(),
    });

    setGuardandoPago(false);

    if (error) {
      setMensajePago({ tipo: "error", texto: "No pudimos guardar el token. Probá de nuevo." });
      return;
    }

    setTienePagoConfigurado(true);
    setMercadopagoAccessToken("");
    setMensajePago({ tipo: "exito", texto: "Token guardado." });
  }

  async function guardarWebhookSecret(e) {
    e.preventDefault();

    if (!mercadopagoWebhookSecret.trim()) {
      window.alert("Pegá la clave secreta antes de guardar.");
      return;
    }

    setGuardandoWebhook(true);
    setMensajeWebhook(null);

    const { error } = await supabase.from("negocios_pagos").upsert({
      negocio_id: negocio.id,
      mercadopago_webhook_secret: mercadopagoWebhookSecret.trim(),
      actualizado_en: new Date().toISOString(),
    });

    setGuardandoWebhook(false);

    if (error) {
      setMensajeWebhook({ tipo: "error", texto: "No pudimos guardar la clave. Probá de nuevo." });
      return;
    }

    setTieneWebhookConfigurado(true);
    setMercadopagoWebhookSecret("");
    setMensajeWebhook({ tipo: "exito", texto: "Clave guardada." });
  }

  return (
    <div className="space-y-8 max-w-lg">
      <form onSubmit={guardarCambios} className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-[#1E1B1A] mb-3">Identidad visual</h2>

          <label className="block text-sm mb-4">
            Texto de bienvenida
            <textarea
              value={textoBienvenida}
              onChange={(e) => setTextoBienvenida(e.target.value)}
              placeholder="Ej: Reservá tu turno en un par de clics."
              rows={3}
              className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full mt-1"
            />
          </label>

          <div className="flex gap-4 mb-4">
            <label className="flex-1 text-sm">
              Color primario
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="h-10 w-12 border border-[#DCD5CE] rounded-xl shrink-0"
                />
                <input
                  type="text"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
                />
              </div>
            </label>
            <label className="flex-1 text-sm">
              Color secundario
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="h-10 w-12 border border-[#DCD5CE] rounded-xl shrink-0"
                />
                <input
                  type="text"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
                />
              </div>
            </label>
          </div>

          <label className="block text-sm mb-2">
            Logo (URL de la imagen)
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full mt-1"
            />
          </label>
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt="Vista previa del logo"
              className="h-16 w-16 rounded-full object-cover border mt-2"
            />
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B1A] mb-1">Horario de atención</h2>
          <p className="text-sm text-[#5B5451]">
            Ahora se configura en{" "}
            <Link href="/admin/horarios" className="underline underline-offset-2">
              Horarios y bloqueos
            </Link>
            , donde cada día puede tener su propio horario.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B1A] mb-3">Seña</h2>

          <div className="flex gap-4 mb-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="tipoSena"
                checked={tipoSena === "porcentaje"}
                onChange={() => setTipoSena("porcentaje")}
              />
              Porcentaje del servicio
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="tipoSena"
                checked={tipoSena === "monto_fijo"}
                onChange={() => setTipoSena("monto_fijo")}
              />
              Monto fijo
            </label>
          </div>

          <input
            type="number"
            placeholder={tipoSena === "porcentaje" ? "Ej: 30 (%)" : "Ej: 2000 ($)"}
            value={montoSena}
            onChange={(e) => setMontoSena(e.target.value)}
            className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full"
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B1A] mb-1">Notificaciones</h2>
          <p className="text-sm text-[#6B6461] mb-3">
            A este email te avisamos cada vez que se confirma un turno pagado.
          </p>
          <label className="block text-sm">
            Email para avisos de nuevos turnos
            <input
              type="email"
              value={emailNotificaciones}
              onChange={(e) => setEmailNotificaciones(e.target.value)}
              placeholder="tuemail@ejemplo.com"
              className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition w-full mt-1"
            />
          </label>
        </section>

        {mensaje && (
          <p className={mensaje.tipo === "error" ? "text-sm text-red-700" : "text-sm text-green-600"}>
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="bg-[#1E1B1A] text-white font-semibold rounded-full px-5 min-h-11 hover:bg-black transition disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <section className="border-t pt-8">
        <h2 className="text-lg font-semibold text-[#1E1B1A] mb-1">Mercado Pago</h2>
        <p className="text-sm text-[#6B6461] mb-3">
          {cargandoPago
            ? "Verificando..."
            : tienePagoConfigurado
            ? "✓ Cuenta conectada. Pegá un token nuevo acá abajo si querés reemplazarlo."
            : "Todavía no conectaste una cuenta de Mercado Pago para cobrar la seña."}
        </p>
        <form onSubmit={guardarMercadoPago} className="flex gap-2">
          <input
            type="password"
            placeholder="Access Token (TEST-... o APP_USR-...)"
            value={mercadopagoAccessToken}
            onChange={(e) => setMercadopagoAccessToken(e.target.value)}
            className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
          />
          <button
            type="submit"
            disabled={guardandoPago}
            className="bg-[#1E1B1A] text-white font-semibold rounded-full px-5 min-h-11 hover:bg-black transition disabled:opacity-50"
          >
            {guardandoPago ? "Guardando..." : "Guardar"}
          </button>
        </form>
        {mensajePago && (
          <p
            className={
              mensajePago.tipo === "error" ? "text-sm text-red-700 mt-2" : "text-sm text-green-600 mt-2"
            }
          >
            {mensajePago.texto}
          </p>
        )}

        <div className="mt-6 pt-6 border-t border-dashed">
          <h3 className="font-medium mb-1">Webhook (aviso automático de pagos)</h3>
          <p className="text-sm text-[#6B6461] mb-2">
            Para que Mercado Pago te avise apenas se aprueba un pago (sin depender de que el
            cliente vuelva a la web), cargá esta URL en tu panel de Mercado Pago: <strong>Tus
            integraciones → tu aplicación → Webhooks → Configurar notificaciones</strong>, y
            tildá el evento &quot;Pagos&quot;.
          </p>
          <div className="bg-[#F6F4F1] rounded-lg px-3 py-2 text-xs font-mono break-all mb-3">
            {urlWebhook}
          </div>
          <p className="text-sm text-[#6B6461] mb-2">
            {cargandoPago
              ? "Verificando..."
              : tieneWebhookConfigurado
              ? "✓ Clave del webhook configurada."
              : "Al cargar la URL, Mercado Pago te va a mostrar una clave secreta ahí mismo: pegala acá."}
          </p>
          <form onSubmit={guardarWebhookSecret} className="flex gap-2">
            <input
              type="password"
              placeholder="Clave secreta del webhook"
              value={mercadopagoWebhookSecret}
              onChange={(e) => setMercadopagoWebhookSecret(e.target.value)}
              className="border border-[#DCD5CE] bg-white rounded-xl px-3 py-2 min-h-11 text-base focus:border-[#1E1B1A] focus:outline-none transition flex-1 min-w-0"
            />
            <button
              type="submit"
              disabled={guardandoWebhook}
              className="bg-[#1E1B1A] text-white font-semibold rounded-full px-5 min-h-11 hover:bg-black transition disabled:opacity-50"
            >
              {guardandoWebhook ? "Guardando..." : "Guardar"}
            </button>
          </form>
          {mensajeWebhook && (
            <p
              className={
                mensajeWebhook.tipo === "error" ? "text-sm text-red-700 mt-2" : "text-sm text-green-600 mt-2"
              }
            >
              {mensajeWebhook.texto}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
