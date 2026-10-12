# Playbook: alta de un negocio nuevo

27/09/2026 · Paulina

Cada negocio real nuevo es siempre una fila nueva en la tabla `negocios` de Supabase — nunca se edita ni se "convierte" el piloto (`unas-test`, mostrado como "by olivia"). El piloto queda permanente con `modo_demo = true`, como vidriera de portfolio; cada cliente nace con su propio `slug`, `modo_demo = false` (su valor por defecto) y sus propias credenciales reales de Mercado Pago.

**Oferta (actualizado 08/10/2026):** $120.000 pago único (50% al firmar, 50% al publicar) + $25.000/mes, diseño a medida siempre incluido, online en 14 días (ver la landing de Agenda Estudio y `camino-a-lanzamiento.md`). Desde el 12/10/2026 la plataforma ya hace todo lo que promete la landing (Parte 3 de `camino-a-lanzamiento.md`).

**Documentos:**
- Términos del servicio (contrato): https://claude.ai/code/artifact/dcbf0f13-96a9-4060-9231-27ef8a2d1e58
- Formulario de relevamiento (copiar uno por cliente): https://claude.ai/code/artifact/a6e81fa5-cbed-42c8-94f4-10c4a87ccd33
- Guía de la suscripción mensual en Mercado Pago: https://claude.ai/code/artifact/4567dfd6-9a56-4ddf-80f7-1628fbba44ce

## Paso 0 — Una sola vez, antes del primer cliente
1. **Facturación:** estar inscripta en el monotributo (ARCA) con una actividad que cubra este servicio y una categoría que alcance; confirmarlo con un contador. Cada cobro lleva su factura C (ARCA → Comprobantes en línea).
2. **Plan de suscripción en Mercado Pago:** crear el plan "Agenda Estudio · Mantenimiento mensual" de $25.000 siguiendo la guía de arriba. Es el mismo link para todos los clientes.
3. **Planes pagos, al cobrar el primer pago:** Vercel → Settings → Billing → Upgrade a Pro (≈ USD 20/mes; el plan gratis no permite uso comercial) y Supabase → Billing → Pro (≈ USD 25/mes; el gratis pausa el proyecto si no hay actividad y no tiene backups). Se pagan con tarjeta en dólares: sumar los impuestos argentinos a pagos en el exterior.

## Paso 1 — Firmar, cobrar el 50% y reunir información
1. Completar y firmar los términos del servicio (con el CUIT de Paulina y los datos del cliente).
2. Cobrar el primer 50% del alta ($60.000) con un link de pago de Mercado Pago (o transferencia) y hacer su factura C.
3. Mandarle el formulario de relevamiento. Reunir del cliente:
- Nombre del negocio y rubro (peluquería, uñas, estética, y a futuro odontología/kinesiología)
- Sucursales, si tiene más de una
- Servicios, con precio, duración y categoría de cada uno
- Profesionales que atienden, y qué servicios hace cada uno
- Horario de atención
- Qué monto o % quiere pedir de seña
- Material para el diseño: logo, fotos, colores o referencias que le gusten, tono con el que habla su marca
- Dominio que quiere (.com.ar) — verificar que esté libre en NIC Argentina
- Email donde quiere recibir los avisos de turnos nuevos

Los 14 días de entrega cuentan desde que llega todo este material.

## Paso 2 — Alta en Supabase
Dar de alta:
1. Fila nueva en `negocios` (Supabase), con un `slug` único propio del cliente y `modo_demo` en `false` (su valor por defecto — nunca hay que tocarlo)
2. Usuario dueño en Supabase Auth, vinculado a esa fila como `owner_id`

## Paso 3 — Cargar servicios, profesionales y horarios
El cliente (o Paulina por él, al principio) carga desde `/admin`: servicios y equipo ("Servicios y equipo"), sucursales, y en "Horarios y bloqueos" el horario de cada día, los feriados/cierres ya previstos y las vacaciones del equipo.

## Paso 4 — Conectar Mercado Pago
1. El cliente pega su propio Access Token en `/admin/configuración`
2. Copiar la URL de webhook que el panel arma sola
3. Cargarla en el panel de Mercado Pago junto con el evento "Pagos"
4. Pegar de vuelta en el panel la clave secreta que Mercado Pago devuelve

**Importante:** probablemente convenga que Paulina ayude a mano la primera vez — encontrar el Access Token y configurar el webhook en Mercado Pago es un paso técnico que un dueño de peluquería o salón de uñas típicamente no va a saber hacer solo. Este flujo ya quedó probado de punta a punta con el piloto.

## Paso 5 — Diseño a medida
Siempre incluido (decidido 08/10/2026): cada cliente tiene su propia piel diseñada desde cero, no hay estilos base preparados de antemano. Es la etapa de más trabajo manual.
1. Propuesta visual con el material del Paso 1 (la landing promete una propuesta en 48 h).
2. Hasta 2 rondas de ajustes.
3. Llevarla a código como un componente NUEVO (ej. `SkinNombreCliente.js`, nunca el archivo del piloto), siguiendo el patrón de `SkinPilotoByOlivia.js`: componente de presentación puro + un desvío en `page.js`. Con el segundo cliente con piel propia, conviene cambiar el `if` por slug a un campo `plantilla_visual` en `negocios`.
4. Armar también su plantilla de mails al cliente (comprobante + recordatorio) con el mismo diseño: copiar `src/lib/emails/mailClienteByOlivia.js` como archivo nuevo y sumarlo por slug en `mailCliente.js`.
5. Igual cargar los campos genéricos del panel (colores, logo, texto de bienvenida) como respaldo.

## Paso 6 — Dominio propio
1. Registrar el dominio .com.ar en NIC Argentina (aclarar en los términos a nombre de quién queda).
2. Agregarlo (con y sin `www.`) al proyecto **de la plataforma** en Vercel (no al de la landing), y cargar en NIC Argentina lo que indique Vercel — lo más simple es delegar a los nameservers de Vercel. El SSL lo pone Vercel solo.
3. Cargar el dominio en la fila del negocio, sin `www.` ni `https://`:
   `update negocios set dominio = 'sudominio.com.ar' where slug = 'su-slug';`
   Desde ese momento `src/proxy.js` muestra su página en la raíz del dominio (puede tardar hasta 5 minutos por la cache).

## Paso 7 — Configurar notificaciones
Email del dueño cargado en el panel, para que le lleguen los avisos de turno nuevo (requiere el dominio de la plataforma verificado en Resend). Chequear que también salgan el comprobante y el recordatorio del día anterior al cliente. Sumar WhatsApp más adelante, cuando el volumen de un cliente lo pida.

## Paso 8 — Probar el circuito completo
Probar el circuito completo con ese negocio, ya en su dominio propio (reservar → pagar → confirmación → mail a la dueña → comprobante al cliente) antes de darlo por lanzado. Con credenciales reales, hacer una reserva con una seña chica de verdad y después cancelarla / devolverla desde Mercado Pago.

## Paso 9 — Publicar, cobrar y entregar
1. Pasarle al cliente su link (`sudominio.com.ar`), su usuario del panel, y una explicación corta de cómo usar el panel: Agenda (ver turnos, cancelar, bloquear tocando un horario libre), Señas, y Horarios y bloqueos.
2. Cobrar el segundo 50% del alta ($60.000) y hacer su factura C.
3. Mandarle el link de la suscripción mensual de Mercado Pago (mensaje modelo en la guía). Si prefiere transferencia, paga del 1 al 10 de cada mes.

No hace falta ningún deploy nuevo para los datos — el negocio vive en la misma plataforma, junto al piloto (que sigue intacto en su propio slug). Solo hay deploy si se sumó una piel a medida nueva (Paso 5).

## Mes a mes, con cada cliente
1. Después del día 5, revisar en Mercado Pago → Planes de suscripción que se hayan cobrado todas las mensualidades.
2. Hacer la factura C de cada cobro.
3. Si un cobro falló, escribirle al cliente. Según los términos: a los 15 días del aviso impago la web se puede pausar; a los 60 días se da de baja.

## Cosas a tener en el radar

| Tema | Qué tener en cuenta |
| --- | --- |
| Límites de planes gratuitos | Resend: 100 emails/día y 3.000/mes, compartido entre todos los negocios de la plataforma. Vercel Hobby es gratis pero no para uso comercial — pasar a Pro al empezar a cobrar. Revisar también los límites del plan gratuito de Supabase antes de sumar varios negocios con tráfico real |
| Un dueño = un negocio | Hoy se asume un usuario de Supabase Auth por negocio. No es problema para el primer cliente ni para varios con un dueño cada uno, pero un cliente con más de un local manejado como negocios separados con el mismo login, o una vista propia de Paulina para administrar varios clientes desde una cuenta, no existe todavía |
| OAuth con Mercado Pago | Conectar con un click (en vez de pegar el Access Token a mano) queda como mejora futura — más importante cuantos más clientes no técnicos haya que onboardear |
| Soporte y mantenimiento | Definir, aunque sea informalmente, qué pasa cuando algo se rompe para un cliente real: quién lo arregla y en cuánto tiempo |
| Editar negocio desde el panel | Hoy cambiar nombre, slug o rubro de un negocio requiere SQL directo — anotado como mejora futura |
| Reservas sin pagar | Resuelto (10/10/2026): una reserva sin pagar retiene el horario 30 minutos y después se libera sola; en el panel figura como "Sin pagar (horario liberado)" |

---

**Pregunta de Paulina sobre el Paso 5 — resuelta el 08/10/2026:** no se preparan 2–3 estilos base de antemano; el diseño se arma con cada cliente. Documento original: https://claude.ai/artifact/905e3e4f-1482-46d7-af14-6e173ad7b633
