# Playbook: alta de un negocio nuevo

27/09/2026 · Paulina

Cada negocio real nuevo es siempre una fila nueva en la tabla `negocios` de Supabase — nunca se edita ni se "convierte" el piloto (`unas-test`, mostrado como "by olivia"). El piloto queda permanente con `modo_demo = true`, como vidriera de portfolio; cada cliente nace con su propio `slug`, `modo_demo = false` (su valor por defecto) y sus propias credenciales reales de Mercado Pago.

**Oferta (actualizado 08/10/2026):** $120.000 pago único + $25.000/mes, diseño a medida siempre incluido, online en 14 días (ver la landing de Agenda Estudio y `camino-a-lanzamiento.md`). Antes de usar este playbook con el primer cliente, revisar la checklist de la Parte 3 de `camino-a-lanzamiento.md` — hay funciones que promete la landing y todavía no existen.

## Paso 1 — Reunir información del cliente
Antes de tocar nada, cobrar el pago de alta (o la parte acordada), firmar los términos simples y reunir del cliente:
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
El cliente (o Paulina por él, al principio) carga desde `/admin`: servicios, profesionales y horarios de atención.

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
Email del dueño cargado en el panel, para que le lleguen los avisos de turno nuevo (requiere el dominio de la plataforma verificado en Resend). Chequear que también salgan el comprobante y el recordatorio de 24 h al cliente. Sumar WhatsApp más adelante, cuando el volumen de un cliente lo pida.

## Paso 8 — Probar el circuito completo
Probar el circuito completo con ese negocio, ya en su dominio propio (reservar → pagar → confirmación → mail a la dueña → comprobante al cliente) antes de darlo por lanzado. Con credenciales reales, hacer una reserva con una seña chica de verdad y después cancelarla / devolverla desde Mercado Pago.

## Paso 9 — Publicar y entregar
1. Pasarle al cliente su link (`sudominio.com.ar`), su usuario del panel, y una explicación corta de cómo usar el panel (ver reservas, cancelar, bloquear horarios, cargar ausencias).
2. Arrancar a cobrar la mensualidad.

No hace falta ningún deploy nuevo para los datos — el negocio vive en la misma plataforma, junto al piloto (que sigue intacto en su propio slug). Solo hay deploy si se sumó una piel a medida nueva (Paso 5).

## Cosas a tener en el radar

| Tema | Qué tener en cuenta |
| --- | --- |
| Límites de planes gratuitos | Resend: 100 emails/día y 3.000/mes, compartido entre todos los negocios de la plataforma. Vercel Hobby es gratis pero no para uso comercial — pasar a Pro al empezar a cobrar. Revisar también los límites del plan gratuito de Supabase antes de sumar varios negocios con tráfico real |
| Un dueño = un negocio | Hoy se asume un usuario de Supabase Auth por negocio. No es problema para el primer cliente ni para varios con un dueño cada uno, pero un cliente con más de un local manejado como negocios separados con el mismo login, o una vista propia de Paulina para administrar varios clientes desde una cuenta, no existe todavía |
| OAuth con Mercado Pago | Conectar con un click (en vez de pegar el Access Token a mano) queda como mejora futura — más importante cuantos más clientes no técnicos haya que onboardear |
| Soporte y mantenimiento | Definir, aunque sea informalmente, qué pasa cuando algo se rompe para un cliente real: quién lo arregla y en cuánto tiempo |
| Editar negocio desde el panel | Hoy cambiar nombre, slug o rubro de un negocio requiere SQL directo — anotado como mejora futura |
| Horarios de pagos rechazados | Si una seña se rechaza, el horario reservado no se libera solo todavía — anotado como mejora futura |

---

**Pregunta de Paulina sobre el Paso 5 — resuelta el 08/10/2026:** no se preparan 2–3 estilos base de antemano; el diseño se arma con cada cliente. Documento original: https://claude.ai/artifact/905e3e4f-1482-46d7-af14-6e173ad7b633
