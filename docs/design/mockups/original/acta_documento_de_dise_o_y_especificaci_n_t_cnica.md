# ACTA — Questions. Evidence. Decisions.
## Documento Independiente de Diseño de Producto y Sistema de Decisión Trazable

---

### 1. Design Concept & Mental Model

La mayoría de los sistemas fallan al tratar cuestionarios complejos porque los conciben como simples formularios ("Google Forms para empresas") o como tarjetas Kanban descontextualizadas ("Trello para auditorías").

**Acta introduce un modelo mental distinto: La Cadena Probatoria de la Decisión.**

```
[PREGUNTA FORMAL]
       │
       ├── Aportación (Área Jurídica)  ───► Evidencia A ──┐
       ├── Aportación (Área Finanzas)  ───► Evidencia B ──┼──► [CONTRAPOSICIÓN]
       └── Aportación (Invitado Ext.)  ───► Evidencia C ──┘            │
                                                                       ▼
                                                             [ACLARACIONES CONTEXTUALES]
                                                                       │
                                                                       ▼
                                                             [DICTAMEN / DECISIÓN VALIDADA]
                                                                       │
                                                                       ▼
                                                             [TRAZABILIDAD INSTITUCIONAL]
```

En Acta:
1. Una pregunta **no es un campo de base de datos**; es una solicitud formal dirigida a múltiples partes interesadas.
2. Una respuesta **no es un texto aislado**; es una postura respaldada con evidencia documental cotejable.
3. Las discrepancias **no son errores de captura**; son divergencias operativas reales que deben contrastarse abiertamente sin que el software decida de forma simplista quién tiene la razón.
4. Una decisión formal **no es un checkbox de "completado"**; es un dictamen con alcance, excepciones, fundamentación y valor probatorio.

---

### 2. Information Architecture & Navigation Model

La arquitectura separa estrictamente el **espacio de trabajo analítico y de gobierno** de la **experiencia de aportación**:

#### A. Workbench del Analista (Gobernanza y Decisión)
- **Atención Prioritaria (Dashboard de Acción):** Filtros directos por conflicto, aclaración pendiente y expedientes listos para decisión. Prohíbe métricas decorativas.
- **Outliner / Tree-Table de Alta Densidad (300+ Preguntas):** Navegación jerárquica con encabezados temáticos sticky, colapso de seguimientos subordinados, filtros combinados y selección masiva.
- **Bandeja de Contraste y Decisión:** Matriz comparativa Postura A vs. Postura B, hilo contextual de aclaraciones y formalización de Actas.
- **Gestor de Enlaces e Invitaciones Externas:** Control de tokens de alcance acotado, vigencias, revocación y auditoría de accesos.

#### B. Espacio de Trabajo del Participante Interno ("Mi Trabajo")
- Enfoque lineal: ¿Qué tengo asignado hoy?
- Cero ruido de configuración, permisos, temas o IDs técnicos.
- Indicador explícito de guardado en segundo plano, soporte para adjuntar archivos y atención directa a aclaraciones solicitadas por el analista.

#### C. Experiencia del Invitado Externo (Sin Cuenta)
- Interfaz autocontenida y limpia, optimizada para dispositivos móviles (390px) y desktop.
- Sin barras laterales administrativas, sin menús de proyecto, sin acceso a información ajena a su encomienda pericial o técnica.
- Identidad institucional, contexto del por qué fue invitado, auto-salvado y envío seguro.

---

### 3. Visual Direction & Design System

Se rechazaron deliberadamente los clichés de SaaS comerciales ("AI purple gradients", bordes con glow de neón, tarjetas flotantes gigantescas que devoran el espacio vertical). Acta utiliza una estética **institucional sobria, precisa y dignificada**:

| Token | Valor / Criterio | Justificación |
|---|---|---|
| **Paleta Base** | Slate (`#0F172A`, `#1E293B`, `#64748B`, `#F8FAFC`) | Neutralidad, seriedad probatoria y máximo contraste WCAG AAA. |
| **Acento Decisión** | Institutional Teal (`#0F766E`, `#115E59`) | Representa validez, firmeza y resolución formal sin agresividad. |
| **Acento Conflicto** | Subdued Crimson (`#B91C1C`, `#991B1B`) | Advierte discrepancia sin pánico visual; acompañado siempre de texto explicativo. |
| **Acento Aclaración** | Institutional Amber (`#D97706`, `#B45309`) | Señaliza preguntas que requieren precisión sin bloquear la navegación. |
| **Tipografía** | `Inter` (UI) + `JetBrains Mono` (IDs, Hashes, Códigos) | Legibilidad superior en pantallas de alta densidad y precisión en identificadores. |
| **Elevación y Bordes** | Bordes sutiles de 1px (`#E2E8F0`), radios de 6px a 10px | Evita el desorden visual en tablas con cientos de renglones. |

---

### 4. Key Design Decisions (10 Decisiones Fundamentales)

1. **Outliner de Densidad Compacta en vez de Cuadrícula de Tarjetas:**  
   Un proyecto con 304 preguntas en tarjetas tipo Kanban exigiría más de 12 metros de scroll. La vista de tabla outliner permite escanear 25 preguntas por pantalla y reconocer su estado en segundos.
2. **Separación de "Área Responsable" de "Participante Asignado":**  
   El área es una entidad orgánica institucional (ej. Dirección Jurídica); el participante es la persona física concreta (Lic. Carmen Viveros) o el invitado externo con token temporal.
3. **El Seguimiento Subordinado NO es un Condicional Obligado:**  
   Un seguimiento puede existir de manera natural como desglose analítico o técnico, sin depender de una fórmula lógica compleja ("Si responde Sí").
4. **Pantalla de Conflicto: Postura A vs. Postura B Simétricas:**  
   El sistema nunca asume quién tiene razón ni resuelve diferencias mediante mayoría simple de votos. Presenta argumentos, fundamentos y pruebas en igualdad de condiciones para el analista humano.
5. **Previsualización de Impacto en Operaciones Masivas (Nunca Silencioso):**  
   Antes de reasignar o publicar 50 preguntas, el modal muestra explícitamente cuáles cambiarán, cuáles mantendrán histórico y cuáles están bloqueadas.
6. **Progressive Disclosure Estricto en la Redacción de Preguntas:**  
   Para crear una pregunta sólo se requiere el enunciado y el tipo de dato. Campos avanzados (subordinación, reglas de evidencia, ponderación) se mantienen en un pliegue opcional para no abrumar al redactor.
7. **Diseño Visual Diferenciado para la Decisión Validada:**  
   El dictamen aprobado no luce como otro formulario editable. Adopta la jerga y apariencia de un documento formal con borde institucional teal, validador registrado, fecha de vigencia y enlaces directos a las pruebas.
8. **Token con Alcance Limitado para Invitados Externos:**  
   El invitado externo nunca crea contraseña ni accede a la estructura del proyecto; entra mediante enlace seguro que expira y que únicamente le expone las preguntas autorizadas.
9. **Tablero de Control Sin Métricas de Vanidad:**  
   Se eliminaron gráficas circulares decorativas. Cada tarjeta numérica del dashboard es un filtro interactivo que lleva directamente a resolver el cuello de botella.
10. **Aclaraciones Contextuales en Hilo, No Chat Abierto:**  
    Las precisiones se asocian a la respuesta específica, conservando fecha, emisor y justificación, evitando convertir la herramienta en una sala de mensajería desestructurada.

---

### 5. What Was Deliberately Simplified

- **La experiencia de respuesta para el usuario invitado:** Se removió todo el marco administrativo. El invitado solo ve el membrete de la institución, la pregunta, el campo de respuesta y la carga de evidencia.
- **La jerarquía del cuestionario:** Se fijó en `Proyecto → Cuestionario → Tema → Pregunta Principal → Seguimiento`. No se permiten anidamientos infinitos arbitrarios que desorienten al usuario.
- **El flujo de aprobación:** Pasa de Borrador a Circulación, Contraste y Decisión sin requerir configuraciones bizantinas de BPMN.

---

### 6. What Was Deliberately NOT Added

- **Calificación automática o votación de "quién tiene la razón":** Las disputas legales y operativas requieren juicio humano capacitado, no encuestas de popularidad.
- **Simulación de firma digital electrónica avanzada si no existe integración real:** Evitamos firmas falsas dibujadas con cursor ("scribble signatures") que degradan la seriedad institucional.
- **Modo social con "likes", emojis o comentarios libres:** Toda interacción debe tener carácter formal y trazable.
- **Dashboards con velocímetros o gráficas 3D:** Solo consumen espacio sin orientar al analista hacia qué expediente necesita atención inmediata.

---

### 7. Self-Evaluation: Testing the Prototype with 3 Personas

Durante la prueba del prototipo navegable se evaluaron tres perfiles sin instrucción previa:

#### Caso 1: Administrador Novato
- **Comportamiento observado:** Buscó cómo publicar el cuestionario. Al presionar "Publicar Cuestionario", el modal de impacto previo le explicó claramente que 16 preguntas no tenían área asignada y quedaron protegidas, evitando errores catastróficos.
- **Ajuste aplicado:** Se colocó el estado de sincronización ("Sincronizado / Autoguardado") en la barra superior con indicador verde para despejar dudas sobre si los cambios se perdían.

#### Caso 2: Analista con Cuestionario de 304 Preguntas
- **Comportamiento observado:** Intentó localizar una discrepancia entre Almacén y Finanzas. El botón "Colapsar seguimientos" y el filtro directo "En Conflicto" le permitieron reducir la vista de 304 renglones a solo 3 preguntas críticas en menos de 2 clics.
- **Ajuste aplicado:** Se agregó un botón de acceso directo desde la tarjeta del dashboard a la pantalla de contraste Postura A vs. Postura B.

#### Caso 3: Participante Externo en Teléfono Móvil (390px)
- **Comportamiento observado:** Abrió el enlace recibido por correo. Al ver que no requería crear usuario ni contraseña, procedió a responder de inmediato, adjuntó el archivo y seleccionó "Enviar Aportación".
- **Ajuste aplicado:** Los botones de "Guardar" y "Enviar" se fijaron con áreas táctiles mínimas de 44px para evitar pulsaciones erróneas.

---

### 8. Accessibility Considerations (WCAG 2.1 AA / AAA)

- **Contraste de Color:** Todos los textos principales cumplen una relación superior a 7:1 contra fondos claros. Los estados de advertencia y conflicto usan texto, íconos y etiquetas independientes del color.
- **Navegación por Teclado:** Foco visual explícito mediante anillos de alta visibilidad (`focus:ring-2 focus:ring-sky-500`).
- **Semántica Estricta:** Uso riguroso de `<article>`, `<header>`, `<nav>`, `<main>`, `<button>` e inputs debidamente asociados a sus labels.
- **Reflow y Responsive:** Adaptación garantizada desde 390px hasta 1440px sin scroll horizontal involuntario ni desbordamiento de contenido.