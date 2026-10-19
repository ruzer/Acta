# Dirección IP del cliente detrás de un proxy: propuesta

**Estado: propuesta, no implementada.** Hoy no se confía en ningún encabezado `X-Forwarded-For`; este documento prepara el cambio para revisarlo antes de escribir código.

## El problema

El backend toma `req.ip` y, como Express no tiene `trust proxy`, `req.ip` es la dirección del par TCP. En Docker ese par es el contenedor nginx del frontend (y detrás de él, el proxy de la institución). Todas las personas llegan con la misma dirección.

Los límites por dirección usan esa clave: inicio de sesión (10 fallos en 15 minutos por cuenta **o** por dirección), intercambio de invitaciones y códigos del asistente de instalación. Con una sola dirección, diez fallos de cualquiera bloquean los accesos de todos durante 15 minutos. Es un problema de **disponibilidad**, no de confidencialidad: el límite sigue frenando la fuerza bruta, pero de forma global.

## Lo que no se puede hacer

- **Confiar en `X-Forwarded-For` tal como llega.** Un cliente puede enviarlo y elegir la dirección que se registra: esquivaría el límite o culparía a otra persona.
- Activar `trust proxy` como `true`, que confía en toda la cadena.
- Aceptar el encabezado del par que no sea un proxy configurado.

## Propuesta: confiar solo en proxies configurados

Dos piezas, ninguna activa por defecto, de modo que sin configurar nada el comportamiento es exactamente el actual.

1. **El nginx del frontend reescribe el encabezado**, no lo agrega. Con `ngx_http_realip_module` y una lista `TRUSTED_PROXY_CIDRS` (los proxies de la institución, p. ej. `10.20.0.5/32`):
   - `set_real_ip_from` por cada CIDR y `real_ip_header X-Forwarded-For` con `real_ip_recursive on`: nginx solo toma el encabezado de un par confiable y se queda con la primera dirección no confiable contando desde la derecha.
   - `proxy_set_header X-Forwarded-For $remote_addr;` (nunca `$proxy_add_x_forwarded_for`): el backend recibe una sola entrada, puesta por nginx. Cualquier valor enviado por el cliente se descarta.
   - Sin `TRUSTED_PROXY_CIDRS`, nginx no confía en el encabezado y publica su par directo; sigue siendo seguro.
2. **El backend confía en un salto**: `TRUSTED_PROXY_HOPS` (entero de 0 a 3; por defecto 0) aplica `app.set("trust proxy", n)`. Con `1` toma la entrada puesta por nginx, que es la única que existe. El backend solo es alcanzable desde el contenedor del frontend (red interna `web`), así que no recibe tráfico directo de clientes.

Si falta el encabezado o no es una dirección válida, se usa el par TCP. La clave se sigue guardando con hash, como hoy.

## Compatibilidad y despliegue

- Sin configuración nueva no cambia nada. Quien despliegue debe definir los CIDR del proxy y `TRUSTED_PROXY_HOPS=1` juntos; uno sin el otro se queda en el comportamiento actual.
- El proxy de la institución debe enviar `X-Forwarded-For` con la dirección real; si lo reenvía sin cambios, nginx lo trata como no confiable salvo que su par esté en la lista.
- `Administración → Configuración → Sistema` debería mostrar si la dirección de cliente se está leyendo de un proxy configurado (solo estado, sin valores).
- nginx-unprivileged admite plantillas con variables de entorno (`/etc/nginx/templates/*.template`), lo que evita editar el archivo a mano.

## Pruebas necesarias antes de activarlo

1. Unitaria: un `X-Forwarded-For` enviado por un par no confiable se ignora; el de un par confiable se respeta; sin encabezado o con uno inválido se usa el par.
2. Integración con PostgreSQL: dos direcciones distintas detrás del proxy no comparten el límite de acceso; una misma dirección sí.
3. Compose: `nginx -t` con y sin `TRUSTED_PROXY_CIDRS`, y una petición con `X-Forwarded-For` falsificado que no cambia la dirección registrada.
4. Documentar en [SELF-HOSTING](SELF-HOSTING.md) la configuración del proxy y cómo comprobarla.

## Alternativas consideradas

- **Limitar en el proxy de la institución** (`limit_req` por dirección real): útil de inmediato y sin cambios en Acta; no sustituye el límite por cuenta.
- **Protocolo PROXY**: entrega la dirección real sin encabezados, pero exige que todos los saltos lo hablen.
- **Dejarlo como está** y documentar la limitación: válido para instalaciones pequeñas con pocas personas.

## Riesgos

Una lista de CIDR demasiado amplia convierte a cualquier cliente de esa red en confiable. Direcciones IPv6 y IPv4 mapeadas deben normalizarse antes de calcular la clave. Un cambio de dirección real a media ventana reinicia el conteo de esa persona, lo que es aceptable.
