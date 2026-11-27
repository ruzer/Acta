# Buscar cuentas existentes y mostrar listados completos

**Propuesta sin aprobar. No implementada.** Diseño H2 para [#175](https://github.com/ruzer/Acta/issues/175) y [#176](https://github.com/ruzer/Acta/issues/176), revisado contra `a16d3ee0b7eda30fb8fd065e468b7503d4f40b6e` (v0.12.0). Los contratos nuevos necesitan aprobación expresa antes de codificarse. Esta propuesta no autoriza cambios en instalaciones.

## Decisiones que se solicitan

1. Permitir que la administración de un proyecto busque nombres y usuarios de cuentas activas de su institución, con un resultado mínimo y sin acceder al directorio administrativo.
2. Aprobar búsqueda de al menos tres caracteres, hasta 20 resultados por página y 60 consultas por minuto por cuenta autenticada; ofrecer también coincidencia exacta de usuario.
3. Resolver el recorte de 500 mediante operaciones nuevas paginadas, conservando las operaciones actuales que devuelven arreglos. Actualizar los consumidores del producto; los clientes antiguos conservarán su límite hasta actualizarse.
4. No registrar términos ni resultados de búsqueda en la bitácora; conservar la auditoría de los cambios de membresía y registrar solamente señales acotadas de abuso.

La propuesta conserva una cuenta por persona y roles distintos por proyecto. No diseña la reorganización de pantalla de #172 ni cambios en invitaciones de #173.

## Problema y evidencia comprobada

Ejemplo ficticio: Ana administra Proyecto A sin administrar la institución. Bruno tiene cuenta, pero aún no pertenece a A. Ana puede incorporarlo si conoce su identificador; la pantalla no permite encontrarlo. Además, una institución con 620 cuentas solo recibe las primeras 500 en el listado actual, sin aviso.

Las referencias siguientes son `archivo:línea` del commit citado; describen lectura de código, no pruebas ejecutadas de esta propuesta.

| Hecho | Fuente |
| --- | --- |
| El directorio exige administración institucional, ordena por nombre y corta en 500 | `app/backend/src/administration/administration.service.ts:61`–69 |
| La lista de miembros corta en 500, ordenada por fecha | `app/backend/src/administration/administration.service.ts:506`–512 |
| Administración institucional o ADMIN del proyecto puede gestionar sus miembros | `app/backend/src/administration/access.service.ts:59`–75 |
| Se valida institución, cuenta ordinaria y estado activo al incorporar | `app/backend/src/administration/administration.service.ts:526`–547 |
| La pantalla solicita `users`; si falla, usa los miembros existentes como selector | `app/frontend/src/pages/Administration.tsx:661`, 724–760 |
| Los contratos actuales son arreglos, sin total ni cursor | `packages/contracts/src/index.ts:1372`, 1428–1436 |
| El cliente valida estrictamente la respuesta; cambiar un arreglo por un objeto rompe clientes | `app/frontend/src/api.ts:71`–77 |
| El resultado de guardar un miembro se busca dentro de la lista recortada | `app/backend/src/administration/administration.service.ts:586`–588 |
| El cuestionario también incorpora `memberList`, con el mismo recorte | `app/backend/src/questionnaire/questionnaire.service.ts:120`–141 |

Por eso no basta con renombrar el selector ni con elevar el límite. Con más de 500 miembros, guardar puede no encontrar el miembro recién actualizado en la respuesta y el editor puede omitir personas. Estos casos deben tener pruebas propias antes de declarar #176 resuelto.

## 1. Contrato propuesto para candidatos (#175)

**GET `/api/v1/projects/:projectId/member-candidates`**. Solo consulta cuentas; no crea cuentas, membresías ni asignaciones. Exige sesión ordinaria y `membershipAdmin` en cada petición, también al avanzar de página. No modifica el permiso de `GET /users`.

### Entrada exacta

| Campo | Tipo y validación | Valor por omisión |
| --- | --- | --- |
| `projectId` | UUID en la ruta | Obligatorio |
| `q` | Texto de 3 a 200 caracteres después de recortar extremos; rechazar caracteres de control | Obligatorio |
| `match` | `text` o `username-exact` | `text` |
| `limit` | Entero de 1 a 20 | 20 |
| `cursor` | Cadena opaca no vacía, hasta 1024 caracteres; ligada a operación, actor, institución, proyecto, búsqueda y límite | Ausente para primera página |

En `text`, buscar una subcadena literal en nombre visible o usuario, sin distinguir mayúsculas. Los acentos se respetan en esta primera propuesta: no se promete una normalización que hoy no existe. `%` y `_` se tratan como texto literal, no como comodines SQL. En `username-exact`, `q` debe cumplir el formato de usuario existente (3–64 caracteres, letras, números, punto, guion y guion bajo); comparar el usuario completo sin distinguir mayúsculas. No devolver coincidencias aproximadas si no existe el usuario exacto.

No se permite consulta vacía para enumerar el directorio. Orden fijo: `username ASC, id ASC`, con la misma comparación en todas las páginas. La institución ya tiene unicidad de usuario (`app/backend/prisma/schema.prisma:162`). El cursor guarda la última posición; su contenido nunca sustituye el filtro de institución ni la autorización del servidor. Un cursor malformado o de otra consulta produce 400. Los cambios de datos entre páginas no constituyen una foto histórica: la interfaz ofrece volver a buscar y elimina duplicados por identificador al acumular resultados.

### Salida exacta, 200

```json
{
  "items": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "displayName": "Persona de ejemplo",
      "username": "persona.ejemplo",
      "alreadyMember": false
    }
  ],
  "hasMore": false,
  "nextCursor": null
}
```

Cada elemento tiene **solo esos cuatro campos**: `id` UUID de la cuenta, `displayName` y `username` cadenas, `alreadyMember` booleano. La envoltura contiene `items` (0–20 elementos), `hasMore` booleano y `nextCursor` cadena opaca o `null`. Si `hasMore` es verdadero, el cursor debe ser no nulo; en caso contrario debe ser nulo. No hay total de cuentas institucionales en esta búsqueda mínima. Se consulta `limit + 1` para saber si quedan resultados.

`alreadyMember` significa que **existe una membresía**, incluso si está desactivada. No demuestra acceso activo: antes de mostrar «Ya tiene acceso» o editar, consultar la membresía concreta en el listado paginado por `userId` descrito abajo. Mientras tanto mostrar «Ya está en el proyecto». Si su acceso está desactivado, mostrarlo y ofrecer editarlo con los valores vigentes; nunca crear otra membresía ni reactivarla en silencio.

Excluir siempre cuentas `invitationOnly`, cuentas inactivas y cuentas de otras instituciones. La marca solo consulta la pertenencia al proyecto solicitado. No devolver `isOrganizationAdmin`, `mustChangePassword`, correo, sesiones, roles o membresías ajenas. Revalidar elegibilidad al guardar: un resultado de búsqueda no es una autorización permanente. Conservar `setMember`, sus validaciones y la auditoría `PROJECT_MEMBER_CHANGED`.

### Errores y privacidad de la respuesta

Usar el formato de error existente, sin duplicarlo ni introducir detalles de la consulta en logs:

| HTTP | Cuándo | Tratamiento en pantalla |
| --- | --- | --- |
| 400 | Parámetros, UUID o cursor inválidos | Error junto al campo; corregir o reiniciar búsqueda |
| 401 | Sesión ausente o vencida | Flujo existente para volver a entrar |
| 403 | Invitado por enlace; miembro sin rol ADMIN y sin administración institucional | «No tienes permiso para incorporar personas a este proyecto.» |
| 404 | Proyecto inexistente, de otra institución o no accesible al actor, según la guardia actual | «No se encontró el proyecto o no tienes acceso.» |
| 429 | Se agotó el límite por actor | «Has realizado muchas búsquedas. Espera un minuto y vuelve a intentar.» |
| 5xx o fallo de red | Consulta no completada | «No se pudo cargar la lista. Intenta de nuevo.» |

La precedencia de 403/404 conserva la guardia actual (`access.service.ts:59`–75 y `:31`–51): no devolver información adicional sobre proyectos ajenos. Respuesta `Cache-Control: no-store`, como ya establece `app/backend/src/main.ts:22`–30. No persistir candidatos en almacenamiento del navegador; la caché de consulta se acota a actor, proyecto, texto y cursor, se limpia al cerrar sesión y no reutiliza resultados entre identidades. Cancelar/ignorar respuestas obsoletas si cambia la búsqueda.

## 2. Decisión de privacidad y límite de consultas

| Opción | Ventaja | Costo o riesgo |
| --- | --- | --- |
| Directorio completo sin búsqueda | Fácil de recorrer | Expone todos los nombres y facilita enumeración; no recomendada |
| Solo usuario exacto | Menor descubrimiento de nombres | Exige conocer previamente el usuario; no resuelve bien homónimos ni búsquedas por nombre |
| **Texto mínimo de tres caracteres, 20 por página y modo exacto opcional** | Encuentra personas sin exigir conocimientos técnicos y acota cada lectura | Un administrador de proyecto puede descubrir nombres y usuarios de su institución mediante búsquedas sucesivas |

**Recomendada: tercera opción.** El propietario debe aceptar esa visibilidad institucional mínima. Los límites reducen abuso, pero no impiden que una persona autorizada enumere resultados con tiempo. No deben presentarse como anonimización ni como aislamiento entre áreas de la misma institución.

Propuesta: **60 consultas por minuto y por cuenta autenticada**, sumando proyectos, páginas y ambos modos; ventana fija y 429 con `Retry-After` hasta el fin de la ventana. No limitar por IP compartida. Buscar mediante botón o Enter, no en cada pulsación; cada página cuenta. Es un valor inicial a validar, no una capacidad medida.

**Reutilización comprobada:** no hay un limitador general exportado. `InvitationAuthService.limit` (`app/backend/src/auth/invitation-auth.service.ts:21`–61) es privado y específico de invitaciones: contador atómico en `InvitationRateBucket`, ventanas y claves derivadas. `AuthMaintenanceService` (`app/backend/src/auth/auth-maintenance.service.ts:30`–33) elimina esos contadores expirados. Login y Setup tienen otros límites específicos; no se deben reutilizar sus presupuestos.

Para no añadir dependencias ni migración, se propone extraer el mecanismo atómico compartido, **sin cambiar categorías, valores ni comportamiento de invitaciones**, y usar la tabla existente con un espacio de claves separado `member-directory:v1:<institución>:<actor>:<ventana>`, almacenado como resumen irreversible. La tabla conserva su nombre histórico; documentar su nuevo uso interno. No incluir texto buscado ni un contador distinto por proyecto o término. Autorizar primero y después asignar el contador, para no crear registros por identificadores arbitrarios. Si el propietario no acepta reutilizar esa tabla, separar la decisión de almacenamiento: no improvisar una tabla/migración ni sustituirlo por un límite en memoria que falle al reiniciar o usar varios procesos.

**Auditoría recomendada:** no crear un `AuditEvent` por búsqueda ni guardar texto/resultados; convertiría la bitácora permanente en un directorio de consultas personales. Mantener la auditoría al incorporar/cambiar miembros. Registrar como máximo una señal operativa de límite por actor/ventana, sin términos, nombres, URL completa ni tokens. Revisar que los accesos de proxy no registren los parámetros de esta ruta; es un requisito operativo documentado, no una garantía actual de proxies externos.

## 3. Listas recortadas a 500 (#176)

| Alternativa | Efecto sobre el contrato actual | Evaluación |
| --- | --- | --- |
| Cambiar el arreglo por `{items,total,nextCursor}` | Rompe clientes estrictos y forks sin actualización | Descartada |
| Aumentar o quitar el límite | Mantiene la forma, pero crea respuestas no acotadas y no resuelve escala | Descartada |
| Añadir búsqueda al arreglo sin señal de continuación | Puede ser aditivo, pero sigue sin decir qué falta | Insuficiente |
| Aviso «Mostrando 500 de N» con conteo adicional | Compatible si el conteo va en otra operación; no permite alcanzar la cuenta 501 por sí solo | Solo medida transitoria |
| **Operaciones paginadas nuevas y actualización de consumidores** | Aditivo; las rutas antiguas conservan sus arreglos y permisos | **Recomendada** |

### Contratos aditivos propuestos

| Operación | Permiso y filas | Entrada |
| --- | --- | --- |
| `GET /api/v1/users/page` | `organizationAdmin`; cuentas ordinarias de su institución, activas e inactivas como hoy | `q` opcional (1–200 tras trim), `limit` 1–500, predeterminado 500; `cursor` opcional, máximo 1024 |
| `GET /api/v1/projects/:projectId/members/page` | `membershipAdmin`; miembros ordinarios del proyecto, activos e inactivos como hoy | Misma entrada; además `userId` UUID opcional, excluyente con `q`, para obtener la membresía exacta |
| `GET /api/v1/projects/:projectId/questionnaire/members/page` | El mismo `access.project` y `editorRoles` que el cuestionario; únicamente miembros ya existentes, nunca candidatos institucionales | Igual que la página de miembros |

Salida estricta de las tres: `{ items, total, hasMore, nextCursor }`. `items` es un arreglo de hasta `limit` de **`userView` existente** en el directorio administrativo o **`memberView` existente** en miembros; `total` es un entero no negativo de coincidencias autorizadas para ese filtro, antes del cursor; `hasMore` y `nextCursor` siguen la regla anterior. No ampliar los campos de estos esquemas (`packages/contracts/src/index.ts:442`–449 y `:466`–475). Con `userId`, habrá cero o una membresía. No confundir este resultado detallado autorizado con la salida mínima de candidatos.

Buscar por nombre visible o usuario, con las mismas reglas de texto literal y mayúsculas. Directorio: orden `displayName ASC, id ASC`. Miembros: `createdAt ASC, id ASC`. La clave final evita empates inestables. Cursor ligado a filtros y contexto autorizado; 400 si es incompatible. Conteo y página se leen en una transacción breve con una instantánea consistente, sin mantenerla entre peticiones. Si alguien cambia datos entre páginas, permitir actualizar la lista; no prometer una instantánea de toda la navegación.

Con hasta 500 filas, conservar la tabla actual sin controles de paginación visibles. Con más, mostrar «Mostrando 500 de 620» y **Ver más**; tras cargar, «Mostrando 620 de 620». La búsqueda permite localizar a quien no aparece sin descargar todas las páginas. El total es el de la búsqueda si hay filtro. No calcular «total» con la longitud del arreglo antiguo. El límite propuesto del directorio de candidatos es independiente de estas lecturas administrativas: no importar un presupuesto nuevo para toda la administración sin medirlo y aprobarlo.

`GET /users`, `GET /projects/:projectId/members` y `POST …/members` conservan su forma y permiso. Las rutas GET antiguas siguen limitadas para los clientes que aún las usen: advertirlo en notas de actualización; compatibilidad no significa que clientes viejos adquieran paginación. Registrar las rutas estáticas nuevas antes de parámetros como `users/:id` para evitar ambigüedades futuras.

### Otros consumidores del recorte: cierre necesario

- `setMember` debe serializar directamente la membresía obtenida por `upsert` con sus datos de usuario/área, en lugar de buscarla en las primeras 500 (`administration.service.ts:586`). **Mismo contrato y permiso**, corrección interna con prueba del miembro 501.
- El editor recibe miembros embebidos en `questionnaireView` mediante `questionnaire.service.ts:141`. Los consume `app/frontend/src/pages/Editor.tsx:624` y `app/frontend/src/pages/editor/BulkDialog.tsx:78`; `Organize.tsx:174` busca nombres de asignaciones. Cambiar solo Administración no resuelve esos selectores.
- Para esos consumidores se propone la tercera ruta de la tabla: paginación de **miembros ya existentes**, con el permiso actual del editor (`QuestionnaireService.editor`, líneas 120–123), sin búsqueda del directorio institucional. La autorización del editor incluye analistas; no reutilizar indiscriminadamente la ruta protegida por `membershipAdmin` ni relajar esa guardia. Declarar `contracts.questionnaireMembersPage` junto al contrato de cuestionario y reutilizar el mismo esquema de página de miembros. El editor debe usar esta fuente para selectores y resolver los nombres de asignaciones ya presentes por su `userId` o mediante las páginas completas; no concluir que un miembro desapareció por no estar en la primera página. No retirar ni cambiar el arreglo embebido mientras haya clientes antiguos. La tercera ruta es también un contrato propuesto que requiere aprobación; no afirmar que #176 está resuelta solo con las dos pantallas de Administración.

La advertencia de H1 sobre ser la única administración se basa en la lista cargada: al migrar a páginas, cargar el conjunto completo autorizado antes de esa conclusión, utilizando la misma operación paginada y sin declarar «única» mientras falten páginas. No inferirlo de una página parcial. Un conteo específico podría optimizarlo después, pero no se propone otro contrato en esta tanda.

## 4. Interfaz propuesta, sin reorganizar la pantalla

Mantener ubicación y finalidad de Miembros. Sustituir el aviso ambiguo por:

> «Busca una cuenta existente para darle acceso a este proyecto. Para crear una cuenta nueva, solicita apoyo a la administración de la institución.»

Orden: campo **Buscar por nombre o usuario**, ayuda «Escribe al menos 3 caracteres», botón **Buscar**, resultados con nombre y usuario, selección, formulario de acceso con valores vigentes (H1), confirmación. El modo **Usuario exacto** es opcional y tiene etiqueta accesible. No mostrar un formulario de creación de cuentas a quien no puede crearlas.

| Estado | Presentación propuesta |
| --- | --- |
| Antes de buscar | Ayuda de tres caracteres; sin consulta ni lista de toda la institución |
| Buscando | «Buscando cuentas…», estado anunciado sin quitar foco |
| Miembro activo comprobado | «Ya tiene acceso»; editar con valores actuales |
| Membresía inactiva comprobada | «Acceso desactivado»; edición explícita |
| Cero resultados | «No encontramos cuentas con esa búsqueda. Revisa el nombre o el usuario.» |
| Sin permiso | Mensaje 403 de la tabla de errores; no fingir ausencia de cuentas |
| Fallo de carga | Mensaje de error y **Reintentar**; no sustituir por un listado incompleto |
| Hay más | «Hay más resultados. Afina la búsqueda o carga más.» y **Ver más** |

Usar controles nativos o los componentes accesibles existentes, resultados seleccionables por teclado, un anuncio `aria-live="polite"` del estado/cantidad y foco conservado al cargar más. No depender del color. Mostrar nombre y usuario para distinguir homónimos; no mover el foco automáticamente mientras se escribe. Los textos de ayuda son propuestos, no nombres de botones ya disponibles.

## 5. Implementación posterior, consumidores y pruebas

Declarar `memberCandidatesQuery`, `memberCandidateView` y `memberCandidatesPage` junto a los esquemas administrativos; añadir `contracts.memberCandidates` junto a `members` en `packages/contracts/src/index.ts:1428`. Añadir los esquemas/operaciones paginados sin modificar las claves existentes. `api()` ya construye consultas GET y valida respuestas (`app/frontend/src/api.ts:24`–77): usarlo, no crear otro transporte.

| PR propuesto, en orden | Tamaño orientativo y archivos | Pruebas exigidas |
| --- | --- | --- |
| 1. #176, directorio y miembros paginados: prerrequisito | Mediano: contratos nuevos; controlador/servicio; tablas/búsqueda en archivos nuevos; corrección interna del resultado de `setMember`; comprobación completa de administradores para H1 | 0, 499, 500, 501 y 620 filas ficticias; todos alcanzables; totales y empates; consulta por `userId` y guardado de un miembro existente fuera de las primeras 500; alta del miembro 501 con respuesta completa; arreglo legacy intacto; permisos; fallos de red; teclado/axe y móvil; ninguna advertencia falsa por una página parcial |
| 2. #175, búsqueda mínima: depende del PR 1 | Mediano: contratos; componente nuevo de búsqueda; inserción mínima en `Administration.tsx`; controlador y servicio de administración; extracción acotada del limitador | Contrato exacto; 401/403/404; instituciones; invitados/inactivos; mínimo de caracteres; literal `%`/`_`; homónimos; paginación; cursor incompatible; 429 concurrente; regresión de límites de invitaciones; `users` sigue en 403 para ADMIN de proyecto; E2E buscar/incorporar/editar con más de 500 miembros |
| 3. #176, miembros embebidos del editor | Mediano: tercer contrato propuesto, controlador/servicio de cuestionario, consumidor del editor y páginas con su permiso de lectura actual | Analista puede ver únicamente los miembros que ya podía ver; no obtiene directorio institucional; participantes 501+ elegibles y nombres de asignaciones |

**Puerta antes de activar la búsqueda de #175:** el PR 1 debe estar integrado y sus rutas disponibles en el servidor, incluida `members/page?userId=…`, y `setMember` debe devolver el miembro guardado sin depender del recorte. No habilitar el selector nuevo contra un servidor que carezca de esos prerrequisitos ni usar el arreglo legacy como sustituto. Con más de 500 miembros, una E2E debe seleccionar una membresía existente fuera de la primera página y precargar su rol, área y estado reales; otra debe incorporar una cuenta nueva como miembro 501 y recibir el resultado completo, sin duplicados ni falsos errores de guardado. Ambas pruebas son necesarias antes de activar la búsqueda, no una tarea posterior de #176.

Los tamaños no son plazos ni mediciones de rendimiento. No crear ni cambiar endpoints en este PR documental. Tras aprobar el diseño, las pruebas deben fallar con la limitación anterior y pasar con el cambio; ejecutar integración real y E2E, además de lint, typecheck, build y unitarias. Revisar lectura con teclado, lector de pantalla y móvil; no declarar probado un lector físico por pasar axe.

Actualizar [Administración de proyectos](PROJECT-ADMINISTRATION.md), ayuda de administración en `docs/ayuda/`, `app/frontend/src/pages/Help.tsx`, sus pruebas anti-deriva (`tests/unit/ayuda.test.ts`) y notas de compatibilidad. Revisar `tests/integration/project-visibility.test.mjs`, `tests/integration/platform.test.mjs`, `tests/e2e/platform.spec.ts` y añadir pruebas específicas de directorio; no debilitar regresiones actuales.

## 6. Compatibilidad, privacidad y estado de verificación

- `users` conserva su permiso y sus campos para administración institucional. El candidato nuevo no es un directorio administrativo abreviado con permisos relajados.
- Nadie obtiene acceso a respuestas, evidencias, decisiones o membresías de otros proyectos. Incorporar a una persona no cambia sus otros accesos ni crea una identidad nueva.
- No se prevé migración: usar tablas/índices existentes, cursores de consulta y contadores existentes según la decisión explícita anterior. Medir planes y tiempos con datos ficticios; si se necesita un índice o tabla nuevo, detenerse y pedir aprobación de esa migración.
- Impacto en forks: las rutas antiguas siguen funcionando; adoptar las rutas nuevas y sus componentes para corregir la lista incompleta. Actualización del servidor antes o junto con el frontend nuevo; un servidor antiguo no sirve las rutas nuevas. No presentar una caída a la lista legacy como resultados completos.
- **Archivos del núcleo institucional que se prevé tocar: ninguno.** Lógica nueva en archivos nuevos; `Administration.tsx` recibe integración mínima. No se prevé editar `App.tsx`, `main.tsx`, `Access.tsx`, `Exchange.tsx`, `Visibility.tsx`, `OrganizationShell.tsx`, `ProjectShell.tsx`, `spanish.ts`, `spanish.test.tsx` ni `app/backend/src/common/http.ts`. Si surge esa necesidad, revisar el alcance antes de hacerlo.
- Esta entrega verifica fuentes de código y consistencia documental. No ejecuta búsquedas nuevas, paginación, límites ni pruebas de 501 cuentas: aún no existen. No modifica datos, permisos, instalaciones ni contratos.

La aprobación de este documento debe registrar las decisiones 1–4 del inicio e incluir explícitamente la tercera ruta para los miembros embebidos del editor. El cierre completo de #176 queda condicionado a resolver también ese consumidor; no se oculta bajo una mejora parcial de la pantalla.
