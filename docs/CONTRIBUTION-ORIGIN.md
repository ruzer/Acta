# Procedencia de contribuciones: DCO 1.1

**ADOPTADO el 2026-10-01: DCO 1.1 + Signed-off-by. Sin CLA inicialmente.** Autor, titular y maintainer inicial de Acta: Cristóbal Ruz Escobar. Las contribuciones aceptadas se distribuyen bajo [AGPL-3.0-only](../LICENSE).

## Certificación

Lee el [Developer Certificate of Origin 1.1 íntegro](../DCO), obtenido del [sitio oficial](https://developercertificate.org/). DCO certifica procedencia y derecho a contribuir bajo la licencia pertinente. No transfiere automáticamente copyright al maintainer, no es un CLA y no reemplaza la autorización del empleador o institución cuando corresponda.

Antes de contribuir, confirma la procedencia de código y assets, conserva avisos de terceros y no firmes una certificación que no puedas sostener. No añadas sign-offs de otras personas. Los documentos privados de autorización no deben adjuntarse a issues públicos.

## Signed-off-by

Con una identidad válida configurada para el repositorio:

```sh
git commit -s
```

El mensaje incluye un trailer con esta forma, donde Name y email representan tu identidad real configurada, no valores a copiar:

```text
Signed-off-by: Name <email>
```

Nombre y correo quedan en el historial público. Revisa esa identidad antes de confirmar el commit. `-s` añade la certificación, pero no verifica por sí solo derechos ni firma criptográficamente el commit. [Documentación de Git](https://git-scm.com/docs/git-commit).

Cada persona debe certificar sus propias aportaciones. Si falta un sign-off, el maintainer solicitará regularizarlo con la persona autora; no lo inventará ni reescribirá historia compartida unilateralmente. No se certifican aportaciones anteriores de terceros por el mero hecho de incorporarlas al snapshot.

## Revisión y decisión

La comprobación inicial es manual en el PR. No se instala DCO GitHub App ni otro bot automáticamente. Su futura adopción sería una mejora administrativa que requiere revisar permisos y configuración.

Se eligió DCO frente a no usar certificación para conservar procedencia de forma uniforme. Un CLA exigiría justificar derechos adicionales y gestionar otro acuerdo; no se adopta inicialmente. DCO no cede titularidad ni habilita relicenciar aportaciones fuera de sus términos. La titularidad del producto ya fue confirmada por el titular; la autorización de cada nueva contribución sigue siendo responsabilidad de quien la aporta.

[CONTRIBUTING](../CONTRIBUTING.md#procedencia-licencia-y-privacidad) · [Gobernanza](../GOVERNANCE.md).
