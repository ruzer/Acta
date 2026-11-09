# Dirección IP del cliente detrás de un proxy

**Estado: implementado.** Acta distingue las direcciones de cliente que recibe a través de proxies configurados. La dirección normalizada alimenta los [límites de inicio de sesión](CONFIGURATION.md#límites-de-inicio-de-sesión), invitaciones y códigos del asistente.

## Qué resuelve

Antes, Express veía la dirección TCP del nginx del frontend. Diez accesos fallidos de usuarios inexistentes desde un cliente podían provocar un 429 también para otras personas, incluida administración, durante 15 minutos.

Ahora la cadena es: cliente → proxy externo opcional → nginx de Acta → backend. Cada límite recibe una dirección validada y normalizada antes de calcular su hash. IPv4 y su representación IPv6 mapeada comparten clave; IPv6 usa su representación canónica. Si falta una dirección válida, se usa el par TCP. No se guardan direcciones en claro en las tablas de límites.

## Dos fronteras de confianza

1. **nginx de Acta:** `TRUSTED_PROXY_CIDRS` es una lista separada por comas de CIDRs IPv4/IPv6 de los proxies externos autorizados. El arranque valida la lista y nginx valida las direcciones al cargar su configuración. Se genera un `set_real_ip_from` por CIDR, `real_ip_header X-Forwarded-For` y `real_ip_recursive on`. Solo se acepta el encabezado si el par pertenece a esa lista; se elige la primera dirección no confiable desde la derecha.
2. **Backend:** `TRUSTED_PROXY_HOPS` acepta enteros de 0 a 3. Configura el número de saltos de confianza de Express. **El código usa 0 por defecto**; Vite y las ejecuciones directas siguen ignorando encabezados de cliente si no se configura otra cosa.

nginx siempre **sobrescribe** `X-Forwarded-For` con `$remote_addr`, una sola dirección. Nunca usa `$proxy_add_x_forwarded_for`. Sin CIDRs, el encabezado enviado por el cliente no decide esa dirección: se usa el par TCP de nginx. También se sobrescriben los encabezados de host y esquema enviados al backend.

**Compose usa 1 por defecto.** Es una decisión deliberada distinta de la propuesta inicial: el archivo base solo publica el frontend, en loopback; el backend no tiene `ports` y pertenece a las redes privadas `web` y `data` del proyecto. `web` conecta frontend y backend; los servicios de datos son internos. Son redes bridge, no redes Docker con `internal: true` (se conserva la conectividad saliente). El acceso al host Docker y a esas redes es de confianza administrativa: no conectes contenedores ajenos o no confiables.

El número de saltos **no es una lista de direcciones autorizadas**. Si un override publica el backend, permite acceso directo de clientes o introduce rutas más cortas, deja `TRUSTED_PROXY_HOPS=0` hasta asegurar la topología. No uses `true` ni aumentes saltos para resolver errores por tanteo. El nginx incluido entrega una sola entrada incluso cuando existe un proxy externo; no necesita 2 saltos.

## Configuración

### Sin proxy externo

Con el Compose base no hace falta añadir variables: hops=1 y CIDRs vacíos. nginx entrega la dirección de su cliente TCP. Docker Desktop, un túnel o NAT pueden sustituir esa dirección: Acta no puede recuperar información que la red ya eliminó.

### Con proxy externo

En el `.env` privado, define únicamente los CIDRs reales de ese proxy, preferiblemente direcciones individuales `/32` o `/128`. Ejemplo documental (sustituir; no es una dirección operativa):

```dotenv
TRUSTED_PROXY_HOPS=1
TRUSTED_PROXY_CIDRS=192.0.2.10/32,2001:db8::10/128
```

El proxy externo debe sobrescribir o construir correctamente `X-Forwarded-For`; no basta con reenviar un valor que el cliente eligió. Evita confiar en toda una LAN, `0.0.0.0/0` o `::/0`. Si el par que nginx observa cambia por NAT, configura y verifica ese salto real, sin ampliar la lista a ciegas.

Aplica la configuración manteniendo el nombre del proyecto Compose y sus volúmenes:

```sh
docker compose up --build -d --wait backend frontend
```

Para volver al comportamiento conservador, una línea en `.env`: `TRUSTED_PROXY_HOPS=0`; vuelve a ejecutar el comando anterior. Esto desactiva la lectura del proxy en el backend, **pero vuelve a compartir el límite por la dirección de nginx**. No elimina intentos almacenados ni reinicia sus ventanas.

## Cómo comprobarlo

1. Revisa `docker compose config`: solo el frontend debe publicar un puerto. Revisa también cualquier override y las redes conectadas. No compartas la salida completa: puede incluir secretos.
2. Ejecuta `docker compose exec frontend nginx -t`. Una lista malformada debe impedir el arranque, no abrir confianza. `nginx -T` permite al operador comprobar los `set_real_ip_from` y que se usa `$remote_addr`, sin publicar esa configuración.
3. En **Administración → Configuración → Sistema**, «Dirección IP del cliente» muestra «Desde un proxy configurado» cuando el backend tiene saltos habilitados, o «Desde la conexión directa» con cero. Es el estado de configuración, no una certificación de que la infraestructura preserve cada IP; no muestra direcciones, CIDRs ni número de saltos.
4. **Solo en una instalación de prueba**, con dos direcciones TCP distintas, intenta diez contraseñas incorrectas de la misma cuenta ficticia desde A. Esa cuenta debe recibir 429 desde A y entrar con su contraseña correcta desde B. Comprueba también los límites agregados: 30 fallos con cuentas distintas bloquean A; 100 fallos de una cuenta repartidos entre varias direcciones bloquean esa cuenta. Todos usan una ventana de 15 minutos.
5. Repite enviando un `X-Forwarded-For` arbitrario desde un par fuera de la lista: no debe cambiar la clave registrada ni el límite. Con un proxy autorizado, verifica que clientes distintos producen claves diferentes. Las pruebas automatizadas también cubren códigos del asistente, invitaciones y normalización.

No ejecutes pruebas de bloqueo sobre cuentas ni instalaciones productivas. Un grupo detrás del mismo NAT seguirá compartiendo la dirección pública y su límite: este cambio separa direcciones, no identifica personas ni elimina el límite por IP.

## Referencias técnicas

- [Express: aplicación detrás de proxies](https://expressjs.com/en/guide/behind-proxies/).
- [nginx: módulo realip y cadena recursiva](https://nginx.org/en/docs/http/ngx_http_realip_module.html).
- [Imagen nginx-unprivileged](https://github.com/nginx/docker-nginx-unprivileged): se conserva su entrada de arranque y la sustitución de plantillas, acotada a las directivas generadas.
