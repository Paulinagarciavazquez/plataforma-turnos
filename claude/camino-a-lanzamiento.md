# Camino a lanzamiento: piloto público + primer cliente real

Este doc responde preguntas que se hizo Paulina el 25/09/2026 sobre cómo llevar el proyecto de "corre en mi compu" a "piloto público mostrable" y, después, a "servicio que le puedo vender al próximo negocio". Complementa `claude/contexto-general-proyecto.md` (que documenta lo ya construido paso a paso); este doc mira hacia adelante.

**Aclaración importante (26/09/2026):** el piloto (Salón de Uñas Test, `unas-test`) es y va a seguir siendo permanente en el portfolio de Paulina — nunca se "convierte" en la web de un cliente real. Cuando llegue un cliente, se da de alta un negocio NUEVO (fila nueva en `negocios`, slug propio) siguiendo el playbook de la Parte 2, con sus propios datos y credenciales reales de Mercado Pago. El piloto queda intacto, con `modo_demo = true` para siempre, como vidriera de la plataforma. Todo el resto de este documento da por sentado este punto.

## Parte 1 — Publicar el piloto ("by olivia", antes Salón de Uñas Test)

**Deploy hecho el 25/09/2026, verificado en vivo el 28/09/2026 y de nuevo el 29/09/2026.** El piloto está público en Vercel: `https://plataforma-turnos-9bcp.vercel.app/unas-test` — es el link que Paulina va a pegar en su landing/portfolio. Verificado navegando el flujo real (sucursal → categoría → servicios): carga sin errores de consola, muestra el nombre "by olivia", el cartel de modo demo, las dos sucursales (By Olivia centro / By Olivia Chacras) y la lista de servicios con precios prolijos y creíbles.

**Nota (07-08/10/2026):** el plan gratuito de Supabase pausa proyectos inactivos por ~7 días. Si el link vuelve a dar "no encontramos este negocio" y no hay nada en el código que lo explique, lo primero a revisar es si el proyecto de Supabase está pausado (entrar a supabase.com → el proyecto → botón "Restore"/"Resume").

**Lo técnico, en orden:**
1. **Deploy real.** Hecho — repo de GitHub (`Paulinagarciavazquez/plataforma-turnos`) conectado a Vercel, deploy automático en cada `git push origin main`.
2. **Dominio.** Resuelto con el subdominio gratuito `plataforma-turnos-9bcp.vercel.app` — ya desbloqueó la vuelta automática de Mercado Pago (ver punto 5). Falta todavía verificar un dominio en Resend (punto 7). Un dominio propio con nombre de marca queda como mejora futura, no urgente.
3. **Variables de entorno en Vercel**: cargadas las 4 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`).
4. **`npm install` limpio antes de desplegar.** Hecho — `package-lock.json` regenerado limpio antes del primer deploy.
5. **Probar el circuito completo ya en la URL pública.** Probado y funcionando el 25/09/2026: reservar → pagar con Mercado Pago de prueba → redirección automática de vuelta al sitio → reserva confirmada → mail recibido. En el camino apareció y se arregló un bug real: faltaba el campo `auto_return: "approved"` en la preferencia de pago (`src/app/api/crear-preferencia/route.js`) — sin eso, Mercado Pago nunca redirige sola, deja a la clienta en su propia pantalla con un botón manual "Volver al sitio". `auto_return` exige que las `back_urls` sean https, por eso el bug no se podía notar ni arreglar en local (localhost es http) — recién se pudo detectar y probar una vez desplegado en un dominio https real. Commit `b6c201e`.
6. **Configurar el webhook.** Hecho el 26/09/2026 — URL y clave secreta cargadas en el panel de Mercado Pago (la sección "Webhook" ya construida en `/admin/configuracion` muestra la URL lista para copiar y guarda la clave secreta en `negocios_pagos.mercadopago_webhook_secret`, usada para validar la firma `x-signature` de cada notificación).
7. **Verificar un dominio en Resend** (agregar registros DNS) para que el mail de aviso pueda mandarse a cualquier dirección, no solo a la de Paulina. Todavía no hecho — no bloquea nada del piloto: el mail sigue llegando bien a la propia Paulina sin esto, solo hace falta el día que un cliente real necesite recibir los avisos en su propio mail.

**Modo demo — agregado el 26/09/2026.** Surgió una pregunta clave de Paulina: como el piloto usaba credenciales de prueba de Mercado Pago, cualquier visitante que llegara al paso de pago se topaba con el sandbox de MP, que pide iniciar sesión con un usuario de prueba comprador — algo que solo tiene Paulina, no un prospecto cualquiera. Para que el piloto se pueda chusmear de punta a punta sin que nadie necesite ninguna cuenta, se agregó una columna `negocios.modo_demo` (boolean): cuando está en `true`, el paso de pago no llama a Mercado Pago — simula la aprobación al toque vía un nuevo endpoint (`/api/simular-pago-demo` → `confirmarReservaDemo` en `src/lib/confirmarPago.js`), que revalida `modo_demo` del lado del servidor antes de confirmar nada, así que un negocio real nunca puede saltear un cobro de verdad por esta vía. Se sumó también un cartel visible ("Estás viendo una demo — no se cobra plata real, el pago se simula automáticamente") en ambas pieles (genérica y `SkinPilotoByOlivia.js`) cuando el negocio está en modo demo. Probado de punta a punta en producción el 26/09/2026: todo el flujo (sucursal → servicio → auto-skip de profesional → día → horario → datos → confirmar) termina en la pantalla de "¡Turno confirmado!" sin pasar por Mercado Pago, sin errores de consola. Commit `48645b4`.

El piloto (`unas-test`) se queda con `modo_demo = true` **para siempre** — es la vidriera de portfolio, no algo que se "active y desactive" para convertirlo en la web de un cliente. `modo_demo` es un campo por negocio, pensado para cualquier negocio que en algún momento se quiera mostrar como demo (el piloto de hoy, o algún futuro negocio de muestra); los negocios reales que se den de alta siguiendo el playbook de la Parte 2 nacen directamente con `modo_demo = false` (su valor por defecto) y sus propias credenciales reales de Mercado Pago, sin tocar nunca la fila del piloto.

**Cuánto sale, en plata (26/09/2026, sujeto a que estos precios cambien):**

| Servicio | Gratis alcanza para... | Cuándo hay que pagar y cuánto |
|---|---|---|
| Vercel (hosting) | El piloto de portfolio, mientras se considere uso personal/no comercial | Plan Pro ≈ USD 20/mes por usuario, obligatorio en cuanto la plataforma factura a clientes reales (uso comercial) |
| Dominio propio | No hace falta uno para arrancar (`algo.vercel.app` es gratis) | Un `.com` ronda USD 10–15/año si más adelante se quiere uno con nombre propio |
| Supabase (base de datos) | El piloto y varios negocios chicos reales sin problema | Plan Pro ≈ USD 25/mes, solo si el uso crece bastante (más adelante, no ahora) |
| Resend (email) | El piloto y varios negocios reales con volumen moderado (3.000 emails/mes gratis) | Recién si se supera ese volumen |
| Mercado Pago | Sin costo fijo nunca | Se queda con su comisión normal por transacción, la paga cada negocio sobre su propia plata |

**En criollo: arrancar el piloto público hoy sale prácticamente $0.** El gasto fijo mensual (Vercel Pro, y eventualmente Supabase Pro) recién aparece cuando el proyecto pasa de "portfolio" a "cobrándole a clientes reales" — en ese momento, calculá entre USD 20 y 45/mes según cuánto crezca, más lo que cueste el dominio.

**Presentación/contenido — todo hecho:** datos de demo prolijos y creíbles (precios/servicios reales por categoría), diseño visual a medida tipo "by olivia" llevado al código real, cartel de "modo prueba", favicon y metadata propios, pantalla amigable para negocio inexistente, nombre "by olivia" confirmado, repaso mobile confirmado.

## Parte 1.5 — Panel de administración: agenda día por día + rediseño visual (26-27/09/2026)

**Vista de agenda por día en "Reservas".** Reemplaza la lista simple de reservas por una navegación día por día: flechas "← Anterior" / "Siguiente →", el nombre del día actual bien visible, un botón "Volver a hoy" que aparece solo si te moviste de la fecha de hoy, y debajo la lista de turnos filtrada a ese día. No agrega ninguna consulta nueva a la base de datos — filtra en el momento la misma lista de reservas que ya se traía. Commit `272fb05`.

**Rediseño visual general del panel de admin (26/09/2026).** A pedido de Paulina ("un diseño visual generico pero estetico, con colores claros, que los botones tengan su burbujita"), se aplicó un estilo consistente y genérico (no a medida por cliente) a todo `/admin`: fondo lavanda claro, tarjetas blancas con sombra suave, botones principales en violeta con forma de píldora, navegación superior con la sección activa resaltada como píldora violeta, inputs redondeados con anillo violeta al enfocar. Commit `510a509`.

**Bug de texto invisible — encontrado y arreglado el 27/09/2026.** Causa: un bloque `@media (prefers-color-scheme: dark)` que traía `globals.css` de fábrica desde el scaffold original de Next.js. Como toda la plataforma es de diseño claro a propósito, se sacó ese bloque entero. Commit `983a380`.

## Parte 2 — Pasos para ofrecer esto como servicio y sumar el próximo negocio sin fricción

**Modelo de cobro — decidido el 27/09/2026.** Fee de alta (pago único al arrancar, cubre el trabajo de configuración y, si corresponde, diseño a medida) + una suscripción mensual chica que cubre hosting y soporte. Se descartó cobrar solo por suscripción (tarda más en cubrir el trabajo inicial) y el % sobre cada seña vía `marketplace_fee` de Mercado Pago (ingreso variable) — queda como posible opción futura.
- Pensar dos niveles de fee de alta: uno para "estilos base" reutilizables, otro más alto si quiere diseño a medida tipo el del piloto.
- Pensar el precio en un equivalente USD (los costos fijos reales están en dólares) y ajustarlo cada tanto en pesos.
- **Montos finales: todavía sin definir** — pendiente de pensar con datos concretos del mercado o al momento de negociar con el primer cliente real. Benchmark de mercado (07/10/2026): Gendu $9.100–$42.100/mes, ReservaSimple Premium $18.999/mes, AgendaPro ~USD 40/mes — todos sin diseño a medida incluido.

**Otras decisiones de negocio pendientes:**
- **Qué incluye la oferta base vs. qué es extra**: si el diseño a medida va incluido siempre o es un adicional. ¿Sucursales múltiples, WhatsApp, webhook, son parte del paquete base o mejoras futuras?
- **Un contrato/términos simples con cada negocio**: qué incluye el servicio, quién da soporte y con qué tiempos, y que la plata de las señas va directo a la cuenta de Mercado Pago del propio negocio, nunca pasa por una cuenta de Paulina.

**Playbook técnico repetible para dar de alta un negocio nuevo**: ver `claude/playbook-alta-negocio.md` en esta misma carpeta.

**Cosas a tener en el radar antes de escalar a varios clientes reales:**
- Límites de planes gratuitos (Resend 100 emails/día y 3.000/mes compartido entre todos los negocios, Vercel Hobby no es para uso comercial, revisar límites de Supabase).
- Hoy se asume un negocio por dueño (un usuario de Supabase Auth = un negocio).
- Conexión OAuth con Mercado Pago (en vez de pegar el Access Token a mano) — mejora futura.
- Soporte y mantenimiento: definir qué pasa cuando algo se rompe para un cliente real.
- Editar nombre/slug/rubro de un negocio desde el panel (hoy solo por SQL directo) — mejora futura.
- Liberación automática de horarios de pagos rechazados — mejora futura.

## Resumen del orden sugerido
1. Deploy en Vercel + dominio simple — hecho.
2. Diseño pulido llevado al código real del piloto + presentación — hecho, 100% listo para compartir como link.
3. Modelo de cobro — decidido (fee de alta + suscripción chica). Falta fijar los montos concretos.
4. Playbook de alta de negocio — escrito (ver `claude/playbook-alta-negocio.md`).
5. Sumar el primer cliente real dando de alta un negocio NUEVO (nunca editando el piloto) siguiendo ese playbook.
6. Recién ahí, con uso real, evaluar si hay que pasar a planes pagos.

**Pendiente hoy:** verificar el dominio en Resend, fijar los montos finales del fee de alta y la suscripción, y definir qué incluye el paquete base vs. qué es extra + un contrato simple.
