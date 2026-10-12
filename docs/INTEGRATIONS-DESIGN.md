# Integraciones y webhooks — diseño (sin implementar)

Acta **no tiene webhooks ni envía correo** hoy. Este documento fija los requisitos mínimos para cuando se decida construirlos; no habilita nada y no hay pantalla ni endpoint asociados. No debe construirse automáticamente: cada punto exige su propia revisión de seguridad.

## Alcance mínimo propuesto

Un módulo de **suscripciones salientes** por institución, administrado solo por la administración de la institución:

- **Eventos permitidos** (lista cerrada, nunca «todos»): p. ej. `question.published`, `response.submitted`, `response.validated`, `invitation.created`. Cada evento lleva un contrato de datos versionado.
- **Destino**: una URL `https://` por suscripción. Sin `http`, sin credenciales en la URL, sin fragmentos.
- **Datos mínimos**: identificadores, tipo de evento, fecha y proyecto. **No** se envían respuestas, textos de preguntas, documentos ni evidencia, ni nombres de personas. Quien necesita más datos los consulta con su propia sesión autorizada. Incluir contenido exigiría una opción explícita por suscripción, con aviso del tratamiento de datos y su propio evento de auditoría.
- **Firma**: HMAC-SHA256 del cuerpo con un secreto por suscripción, con marca de tiempo y `id` de entrega en la firma para evitar repetición. El secreto se muestra una vez al crearlo y se guarda **cifrado** con una clave de infraestructura (no en texto plano, no en el `.env` de la aplicación).
- **Prevención de SSRF**: resolver el nombre antes de conectar y rechazar direcciones privadas, de loopback, de enlace local y de metadatos de nube (incluida la re-resolución en cada intento y tras redirecciones: no se siguen redirecciones); puertos permitidos acotados; tiempo máximo corto; tamaño de respuesta ignorado. Una lista de destinos permitidos configurada por la infraestructura debe poder restringir aún más.
- **Entrega**: cola en PostgreSQL con reintentos con espera creciente y límite, desactivación automática tras fallos repetidos y entrega «al menos una vez» (el receptor debe deduplicar por `id`).
- **Auditoría**: crear, cambiar, desactivar, rotar secreto y cada entrega (resultado, sin cuerpo) quedan en la bitácora, atribuidos a quien actuó.
- **Permisos**: solo administración de la institución; las suscripciones nunca amplían lo que una persona puede leer.
- **Infraestructura**: poder apagar el módulo completo por variable de entorno, igual que `SETUP_WIZARD`, y mostrar en la pantalla qué controla la infraestructura.

## Correo

Antes de una pantalla de correo hace falta decidir si Acta enviará mensajes (invitaciones, avisos). Hoy los enlaces de invitación se copian y comparten manualmente a propósito. Un transporte SMTP traería credenciales (infraestructura, no base de datos), límites de envío y privacidad de destinatarios; se diseña aparte.

## Qué no se hará sin autorización explícita

Enviar contenido de respuestas o evidencia a sistemas externos, aceptar destinos HTTP, guardar secretos de integración en texto plano, o exponer endpoints públicos de administración.
