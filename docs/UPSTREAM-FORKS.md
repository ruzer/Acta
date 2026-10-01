# Upstream y forks de Acta

El upstream oficial es [github.com/ruzer/Acta](https://github.com/ruzer/Acta). Acta permite y espera forks bajo [AGPL-3.0-only](../LICENSE). La publicación del snapshot y los canales remotos se verifican por separado; esta guía no afirma que ya se haya realizado el primer push.

## Vocabulario y recorrido

| Concepto | Qué significa aquí |
|---|---|
| Upstream | Proyecto genérico Acta, que revisa cambios y publica versiones compartidas |
| Fork | Copia derivada mantenida por otra persona u organización |
| Feature branch | Rama corta para un cambio acotado, sin implicar que sea una nueva feature |
| Pull Request (PR) | Propuesta de incorporar un cambio, su explicación y pruebas a otra rama/repositorio |
| Release | Versión identificada y revisada que el maintainer publica con notas y límites |

**Acta upstream → fork organizacional → personalizaciones → mejoras genéricas propuestas por PR → revisión → releases upstream → actualización de los forks.** Una organización puede mantener su variante, recibir cambios periódicamente y devolver partes reutilizables. El PR es voluntario; no garantiza aceptación ni equivale a cumplir todas las obligaciones de licencia.

## Qué proponer al núcleo genérico

Son candidatas, sujetas a revisión: correcciones de seguridad por canal privado; bugs; accesibilidad; UX genérica; rendimiento; tipos de pregunta genéricos; mejoras de cuestionarios y evidencia; providers S3 con pruebas del contrato; exportaciones genéricas; internacionalización; documentación; tests y observabilidad genérica. Esta lista describe posibles contribuciones, no features comprometidas. El soporte real de storage sigue en [S3-PROVIDERS](S3-PROVIDERS.md).

## Qué puede mantenerse en el fork

Branding, integraciones privadas, adaptadores a sistemas internos, reglas exclusivas, reportes o catálogos propios y deployment específico son normalmente responsabilidad del fork. Usa configuración existente antes de modificar código. Cuando sea técnicamente posible, aísla personalizaciones en módulos/capas separados para reducir conflictos; no se promete un sistema de plugins ni se cambia la arquitectura actual.

**Fuera del upstream no significa exento de compartir código cuando la licencia lo exija.** Mantén secretos, datos operativos y credenciales fuera del repositorio, no simplemente en una rama privada. La AGPL-3.0-only contempla obligaciones sobre código fuente y, en determinadas condiciones, interacción por red; no exige enviar PR al proyecto original. La política de forks no concede una excepción. [Texto de AGPL-3.0, sección 13](https://opensource.org/license/agpl-3.0). [Licencia de Acta](../LICENSE).

## Recibir cambios sin perder personalizaciones

Ejemplo documental para un fork local **ya creado**, solo después de publicación. No ejecutar ahora contra el destino pendiente. Requiere working tree limpio, `main` existente y verificar los remotes antes de continuar.

```sh
git status --short
git remote -v
# Solo si no existe un remote llamado upstream y su destino ya fue confirmado:
git remote add upstream https://github.com/ruzer/Acta.git
git fetch upstream
git switch main
git merge --ff-only upstream/main
# Nombre de ejemplo: usa uno nuevo para tu cambio.
git switch -c fix/generic-improvement
```

El destino del ejemplo es **PENDING UNTIL PUBLICATION**. Si `upstream` ya existe, comprueba su URL; no lo sobrescribas automáticamente. Si hay cambios locales sin guardar, detente y resuélvelos antes de cambiar de rama. `--ff-only` rechaza una actualización divergente: no borra commits ni fuerza su sustitución.

Si `main` contiene personalizaciones, integra upstream en una rama de trabajo separada, revisa conflictos y tests, y propone un PR a tu fork. No se prescribe rebase de historia compartida ni force push. Una alternativa sostenible es conservar `main` cerca de upstream y gestionar personalizaciones mediante ramas propias de corta duración cuando sea viable.

Seguir `upstream/main` sirve para desarrollo, no significa desplegarlo automáticamente. Para actualizar una instalación, elige una release, revisa cambios y migraciones, prueba en staging, haz backup coordinado y sigue [Self-hosting](SELF-HOSTING.md#actualizar). Conservar nombre Compose, claves de objetos y volúmenes es parte de la continuidad operativa.

## Devolver una mejora

Crea una rama desde upstream actualizado, lleva únicamente el cambio genérico, conserva atribuciones y explica qué se separó del fork. Verifica que funciona sin endpoints ni datos internos. No subas accidentalmente secretos o historia privada al extraer commits. Confirma autorización de los titulares antes de aportar código institucional y revisa [procedencia de contribuciones](CONTRIBUTION-ORIGIN.md).

Abre PR hacia `main` de Acta cuando el canal esté habilitado, enlaza el issue si existe y atiende revisión. Mantén las diferencias del fork documentadas y comprueba actualizaciones periódicamente; no hay frecuencia ni SLA garantizados. [CONTRIBUTING](../CONTRIBUTING.md) · [Política de forks](../GOVERNANCE.md#política-de-forks).
