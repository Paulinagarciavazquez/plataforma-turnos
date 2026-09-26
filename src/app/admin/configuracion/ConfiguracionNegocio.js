"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// 0=domingo, 1=lunes, ..., 6=sábado (mismo criterio que Date.getDay() en JS,
// usado en el flujo de reserva para decidir qué días mostrar).
const DIAS = [
  { valor: 1, etiqueta: "Lunes" },
  { valor: 2, etiqueta: "Martes" },
  { valor: 3, etiqueta: "Miércoles" },
  { valor: 4, etiqueta: "Jueves" },
  { valor: 5, etiqueta: "Viernes" },
  { valor: 6, etiqueta: "Sábado" },
  { valor: 0, etiqueta: "Domingo" },
];

const COLOR_POR_DEFECTO_PRIMARIO = "#D9A79C";
const COLOR_POR_DEFECTO_SECUNDARIO = "#3A2E2A";

export default function ConfiguracionNegocio({ negocio, actualizarNegocio }) {
  const [horarioApertura, setHorarioApertura] = useState(
    (negocio.horario_apertura || "09:00").slice(0, 5)
  );
  const [horarioCierre, setHorarioCierre] = useState(
    (negocio.horario_cierre || "18:00").slice(0, 5)
  );
  const [diasSeleccionados, setDiasSeleccionados] = useState(
    negocio.dias_atencion || []
  );
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
  const [urlWebhook, setUrlWebhook] = useState("");

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

  // La URL del webhook depende del dominio desde el que se abre el panel
  // (window.location.origin), así que se arma del lado del cliente.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrlWebhook(`${window.location.origin}/api/webhooks/mercadopago?negocioId=${negocio.id}`);
    }
  }, [negocio.id]);

  function alternarDia(valor) {
    setDiasSeleccionados((prev) =>
      prev.includes(valor) ? prev.filter((d) => d !== valor) : [...prev, valor]
    );
  }

  async function guardarCambios(e) {
    e.preventDefault();

    if (!montoSena) {
      window.alert("Ingresá el monto o porcentaje de la seña.");
      return;
    }
    if (diasSeleccionados.length === 0) {
      window.alert("Seleccioná al menos un día de atención.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const cambios = {
      horario_apertura: horarioApertura,
      horario_cierre: horarioCierre,
      dias_atencion: diasSeleccionados,
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
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Identidad visual</h2>

          <label className="block text-sm mb-4">
            Texto de bienvenida
            <textarea
              value={textoBienvenida}
              onChange={(e) => setTextoBienvenida(e.target.value)}
              placeholder="Ej: Reservá tu turno en un par de clics."
              rows={3}
              className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full mt-1"
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
                  className="h-10 w-12 border border-violet-200 rounded-xl shrink-0"
                />
                <input
                  type="text"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
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
                  className="h-10 w-12 border border-violet-200 rounded-xl shrink-0"
                />
                <input
                  type="text"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
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
              className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full mt-1"
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
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Horario de atención</h2>

          <div className="flex gap-4 mb-4">
            <label className="flex-1 text-sm">
              Apertura
              <input
                type="time"
                value={horarioApertura}
                onChange={(e) => setHorarioApertura(e.target.value)}
                className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full mt-1"
              />
            </label>
            <label className="flex-1 text-sm">
              Cierre
              <input
                type="time"
                value={horarioCierre}
                onChange={(e) => setHorarioCierre(e.target.value)}
                className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full mt-1"
              />
            </label>
          </div>

          <p className="text-sm mb-2">Días que atiende</p>
          <div className="flex flex-wrap gap-3">
            {DIAS.map((dia) => (
              <label key={dia.valor} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={diasSeleccionados.includes(dia.valor)}
                  onChange={() => alternarDia(dia.valor)}
                />
                {dia.etiqueta}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Seña</h2>

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
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full"
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Notificaciones</h2>
          <p className="text-sm text-gray-500 mb-3">
            A este email te avisamos cada vez que se confirma un turno pagado.
          </p>
          <label className="block text-sm">
            Email para avisos de nuevos turnos
            <input
              type="email"
              value={emailNotificaciones}
              onChange={(e) => setEmailNotificaciones(e.target.value)}
              placeholder="tuemail@ejemplo.com"
              className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition w-full mt-1"
            />
          </label>
        </section>

        {mensaje && (
          <p className={mensaje.tipo === "error" ? "text-sm text-red-600" : "text-sm text-green-600"}>
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="bg-violet-600 text-white rounded-full px-5 py-2.5 shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <section className="border-t pt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Mercado Pago</h2>
        <p className="text-sm text-gray-500 mb-3">
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
            className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition flex-1"
          />
          <button
            type="submit"
            disabled={guardandoPago}
            className="bg-violet-600 text-white rounded-full px-5 py-2.5 shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
          >
            {guardandoPago ? "Guardando..." : "Guardar"}
          </button>
        </form>
        {mensajePago && (
          <p
            className={
              mensajePago.tipo === "error" ? "text-sm text-red-600 mt-2" : "text-sm text-green-600 mt-2"
            }
          >
            {mensajePago.texto}
          </p>
        )}

        <div className="mt-6 pt-6 border-t border-dashed">
          <h3 className="font-medium mb-1">Webhook (aviso automático de pagos)</h3>
          <p className="text-sm text-gray-500 mb-2">
            Para que Mercado Pago te avise apenas se aprueba un pago (sin depender de que el
            cliente vuelva a la web), cargá esta URL en tu panel de Mercado Pago: <strong>Tus
            integraciones → tu aplicación → Webhooks → Configurar notificaciones</strong>, y
            tildá el evento &quot;Pagos&quot;.
          </p>
          <div className="bg-gray-100 rounded px-2 py-2 text-xs font-mono break-all mb-3">
            {urlWebhook}
          </div>
          <p className="text-sm text-gray-500 mb-2">
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
              className="border border-violet-200 bg-white rounded-xl px-3 py-2 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition flex-1"
            />
            <button
              type="submit"
              disabled={guardandoWebhook}
              className="bg-violet-600 text-white rounded-full px-5 py-2.5 shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
            >
              {guardandoWebhook ? "Guardando..." : "Guardar"}
            </button>
          </form>
          {mensajeWebhook && (
            <p
              className={
                mensajeWebhook.tipo === "error" ? "text-sm text-red-600 mt-2" : "text-sm text-green-600 mt-2"
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
