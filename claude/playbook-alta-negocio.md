# Playbook: alta de un negocio nuevo

27/09/2026 · Paulina

Cada negocio real nuevo es siempre una fila nueva en la tabla `negocios` de Supabase — nunca se edita ni se "convierte" el piloto (`unas-test`, mostrado como "by olivia"). El piloto queda permanente con `modo_demo = true`, como vidriera de portfolio; cada cliente nace con su propio `slug`, `modo_demo = false` (su valor por defecto) y sus propias credenciales reales de Mercado Pago.

## Paso 1 — Reunir información del cliente
Antes de tocar nada, reunir del cliente:
- Nombre del negocio y rubro (peluquería, uñas, estética, y a futuro odontología/kinesiología)
- Sucursales, si tiene más de una
- Servicios, con precio y duración de cada uno
- Profesionales que atienden
- Horario de atención
- Qué monto o % quiere pedir de seña

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

## Paso 5 — Identidad visual
Como mínimo, campos genéricos desde el panel: colores, logo, texto de bienvenida.

Si el paquete incluye diseño a medida (tipo el del piloto), esa es la etapa de más trabajo manual — conviene optimizarla con el tiempo (por ejemplo, armando 2-3 "estilos base" reutilizables en vez de diseñar desde cero cada vez, si el volumen de clientes lo justifica). El patrón técnico para una piel a medida ya quedó probado con `SkinPilotoByOlivia.js`: un componente de presentación por negocio + un desvío en `page.js` — repetible para el próximo cliente como un componente NUEVO (nunca el mismo archivo del piloto).

## Paso 6 — Configurar notificaciones
Email del dueño cargado en el panel, para que le lleguen los avisos de turno nuevo. Sumar WhatsApp más adelante, cuando el volumen de un cliente lo pida.

## Paso 7 — Probar el circuito completo
Probar el circuito completo con ese negocio (reservar → pagar → confirmación → mail) antes de darlo por lanzado — igual que se hizo con el piloto.

## Paso 8 — Publicar
Publicar el link `tudominio.com/slug-del-negocio`. No hace falta ningún deploy nuevo — ya vive en la misma plataforma, junto al piloto (que sigue intacto en su propio slug).

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

**Comentario pendiente de Paulina (sin responder todavía):** en el Claude Doc original de este playbook quedó una pregunta anotada sobre el Paso 5 — si conviene preparar 2-3 estilos base de antemano o esperar al primer cliente concreto para decidirlo. Documento original: https://claude.ai/artifact/905e3e4f-1482-46d7-af14-6e173ad7b633
