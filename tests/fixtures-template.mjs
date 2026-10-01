export function template(externalId = "IMPORT-DEMO", areaCode = "IMPORT-AREA") {
  return {
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project: {
      externalId,
      name: "Cuestionario ficticio de intercambio",
      description: "Sin información institucional",
    },
    areas: [{ code: areaCode, name: "Equipo ficticio de intercambio" }],
    sections: [
      {
        externalId: "TOPIC-A",
        title: "Tema ficticio",
        description: "Prueba",
        order: 0,
      },
    ],
    questions: [
      {
        externalId: "FORM-14",
        sectionExternalId: "TOPIC-A",
        title: "Pregunta ficticia",
        question: "¿Se requiere seguimiento?",
        priority: "P1",
        type: "YES_NO",
        required: true,
        responsibleAreaCode: areaCode,
        order: 0,
        options: [],
        references: [{ type: "REQUIREMENT", externalId: "REQ-14" }],
        sourceLocator: {
          document: "fixture.md",
          anchor: "pregunta",
          part: "P",
        },
      },
      {
        externalId: "FORM-014",
        sectionExternalId: "TOPIC-A",
        title: "Seguimiento ficticio",
        question: "Explica el seguimiento",
        priority: "P2",
        type: "SHORT_TEXT",
        required: false,
        responsibleAreaCode: areaCode,
        order: 1,
        options: [],
        references: [],
        groupParentExternalId: "FORM-14",
      },
    ],
    conditions: [
      {
        parentQuestionExternalId: "FORM-14",
        childQuestionExternalId: "FORM-014",
        operator: "EQUALS",
        value: true,
      },
    ],
    traceabilityReferences: [
      {
        type: "REQUIREMENT",
        externalId: "REQ-14",
        label: "Requisito ficticio",
        url: "https://example.org/requirement",
      },
    ],
  };
}
