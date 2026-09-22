export interface TechnicalQuestion {
  id: string;
  section: string;
  points: number;
  title: string;
  codeSnippet?: string;
  type: 'radio' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required: boolean;
  rubricHint?: string;
}

export interface PracticalCaseVariant {
  id: 'A' | 'B' | 'C';
  title: string;
  scenario: string;
  requirements: string[];
  evaluationCriteria: string;
}

export const PRACTICAL_CASE_VARIANTS: Record<'A' | 'B' | 'C', PracticalCaseVariant> = {
  A: {
    id: 'A',
    title: 'Variante A: CRM, Facturación Externa y Base de Datos',
    scenario: 'RESET implementará una solución para una empresa que utiliza un CRM, un sistema externo de facturación y una base de datos de clientes. Cuando una oportunidad pasa a GANADA se debe:',
    requirements: [
      '1. Verificar si el cliente existe en facturación;',
      '2. Crearlo si no existe;',
      '3. Crear una factura;',
      '4. Obtener el número de factura;',
      '5. Guardar ese número en el CRM;',
      '6. Notificar al equipo cuando ocurra un error.'
    ],
    evaluationCriteria: 'Tu respuesta debe cubrir flujo de información, prevención de duplicados, manejo de estados parciales, seguridad de credenciales/tokens, trazabilidad y al menos una decisión técnica con ventajas y desventajas.'
  },
  B: {
    id: 'B',
    title: 'Variante B: E-Commerce B2B, ERP Empresarial y Pagos a Crédito',
    scenario: 'RESET implementará una integración para un sistema de e-commerce B2B conectado con un ERP empresarial (SAP/NetSuite) y una pasarela de pagos. Cuando un cliente corporativo confirma una orden de compra con pago a crédito se debe:',
    requirements: [
      '1. Verificar límite de crédito y estado fiscal del cliente en el ERP;',
      '2. Reservar inventario en múltiples almacenes sincronizados;',
      '3. Generar la pre-factura en el ERP con retenciones aplicables;',
      '4. Autorizar la línea de crédito o retención en pasarela de pagos;',
      '5. Actualizar el estado del pedido en la tienda virtual con el número de folio ERP;',
      '6. Orquestar compensación o rollback automático si algún paso intermedio falla.'
    ],
    evaluationCriteria: 'Tu respuesta debe cubrir flujo de información, prevención de duplicados/idempotencia, manejo de estados parciales (patrón saga / compensaciones), seguridad de webhooks y credenciales, trazabilidad y al menos una decisión técnica con ventajas y desventajas.'
  },
  C: {
    id: 'C',
    title: 'Variante C: Sincronización ATS, Contratos Dinámicos y Firma Digital',
    scenario: 'RESET implementará una plataforma de sincronización bidireccional entre un portal de empleo propio, un ATS externo (Zoho Recruit) y una plataforma de firma digital (DocuSign/Sign). Cuando un candidato es seleccionado para contratación se debe:',
    requirements: [
      '1. Validar que los datos personales y fiscales estén completos en el ATS;',
      '2. Generar el contrato laboral personalizado a partir de plantilla dinámica;',
      '3. Enviar solicitud de firma a candidato y apoderado legal vía API;',
      '4. Recibir webhook de firma completada y archivar documento cifrado;',
      '5. Actualizar el estado a "Contratado" en el ATS y crear el expediente de empleado en HRIS;',
      '6. Gestionar reintentos exponenciales ante caídas de API y alertar anomalías al equipo de RRHH.'
    ],
    evaluationCriteria: 'Tu respuesta debe cubrir arquitectura de eventos/webhooks, idempotencia, resiliencia ante caídas de proveedores, cifrado y manejo de datos personales sensibles (PII), trazabilidad y al menos una decisión técnica con ventajas y desventajas.'
  }
};

export const TECHNICAL_QUESTIONS: TechnicalQuestion[] = [
  // 1. Programación y lógica (20 pts)
  {
    id: 'q1',
    section: '1. Programación y lógica',
    points: 4,
    title: '1. ¿Cuál es el resultado del siguiente pseudocódigo?',
    codeSnippet: `total = 0

para i desde 1 hasta 5
    si i % 2 == 0
        total = total + i

imprimir(total)`,
    type: 'radio',
    options: [
      { value: 'A', label: 'A. 5' },
      { value: 'B', label: 'B. 6' },
      { value: 'C', label: 'C. 9' },
      { value: 'D', label: 'D. 15' }
    ],
    required: true,
    rubricHint: 'Respuesta correcta: B (6). Números pares entre 1 y 5: 2 y 4 -> 2 + 4 = 6.'
  },
  {
    id: 'q2',
    section: '1. Programación y lógica',
    points: 6,
    title: '2. Observa la siguiente función conceptual. ¿Qué problema podría ocurrir y cómo lo corregirías?',
    codeSnippet: `function calculateAverage(values):
    total = 0
    for each value in values:
        total = total + value
    return total / length(values)`,
    type: 'textarea',
    placeholder: 'Explica tu análisis y solución.',
    required: true,
    rubricHint: 'Detectar división por cero si el array está vacío (length == 0), manejo de valores nulos o no numéricos, y retorno adecuado (0 o null).'
  },
  {
    id: 'q3',
    section: '1. Programación y lógica',
    points: 10,
    title: '3. Recibes la lista siguiente y necesitas identificar posibles clientes duplicados utilizando el correo electrónico. Describe el algoritmo.',
    codeSnippet: `[
  {id: 1, email: "ana@email.com"},
  {id: 2, email: "juan@email.com"},
  {id: 3, email: "ana@email.com"},
  {id: 4, email: "maria@email.com"}
]`,
    type: 'textarea',
    placeholder: 'Puedes usar pseudocódigo, código o una explicación precisa.',
    required: true,
    rubricHint: 'Uso de tabla hash / Map / Set / objeto para complejidad O(N), normalización de email (toLowerCase, trim), agrupación por clave y filtrado de ocurrencias > 1.'
  },

  // 2. APIs e integración de sistemas (25 pts)
  {
    id: 'q4',
    section: '2. APIs e integración de sistemas',
    points: 6,
    title: '4. Una integración que funcionaba normalmente comienza a responder HTTP 401 Unauthorized. El código no fue modificado. ¿Qué revisarías y en qué orden?',
    type: 'textarea',
    placeholder: 'Detalla tu orden de revisión.',
    required: true,
    rubricHint: '1. Expiración de token de acceso o refresh token. 2. Revocación/cambio de credenciales o API keys. 3. IP whitelisting / permisos de cuenta de servicio. 4. Cambios en políticas del proveedor.'
  },
  {
    id: 'q5',
    section: '2. APIs e integración de sistemas',
    points: 7,
    title: '5. Tu sistema envía una solicitud para crear una factura. El sistema externo la procesa, pero tu aplicación pierde la conexión antes de recibir respuesta y vuelve a intentarlo. ¿Cómo reducirías o eliminarías el riesgo de crear dos facturas iguales?',
    type: 'textarea',
    placeholder: 'Describe el mecanismo o patrón.',
    required: true,
    rubricHint: 'Patrón de Idempotencia: envío de Idempotency-Key única por operación en cabeceras o cuerpo, consulta previa por ID de referencia/orden antes de reintentar, bloqueo distribuido.'
  },
  {
    id: 'q6',
    section: '2. APIs e integración de sistemas',
    points: 12,
    title: '6. Un sistema externo envía un webhook por cada pago. En algunos momentos llegan cientos de eventos en pocos minutos. Diseña el flujo considerando recepción, validación, procesamiento, errores, reintentos y eventos duplicados.',
    type: 'textarea',
    placeholder: 'Diseña la arquitectura del flujo.',
    required: true,
    rubricHint: '1. Recepción inmediata: responder 200/202 rápido. 2. Validación de firma HMAC del webhook. 3. Desacoplamiento con cola de mensajes (Message Queue / SQS / PubSub). 4. Worker con idempotencia por event_id. 5. Reintentos exponenciales y Dead Letter Queue (DLQ).'
  },

  // 3. Bases de datos (15 pts)
  {
    id: 'q7',
    section: '3. Bases de datos',
    points: 5,
    title: '7. Un CLIENTE puede tener muchas FACTURAS. ¿Qué campo agregarías a FACTURA y qué función tendría?',
    codeSnippet: `CLIENTE
id_cliente
nombre
email

FACTURA
id_factura
fecha
monto`,
    type: 'textarea',
    placeholder: 'Indica el campo y su función.',
    required: true,
    rubricHint: 'Agregar `id_cliente` en la tabla FACTURA como Llave Foránea (Foreign Key) para relacionar cada factura con su cliente propietario.'
  },
  {
    id: 'q8',
    section: '3. Bases de datos',
    points: 5,
    title: '8. Tenemos una tabla clientes(id, nombre, email, activo). ¿Cómo obtendrías todos los clientes cuyo campo activo sea verdadero? Puedes escribir SQL o explicar la operación.',
    type: 'textarea',
    placeholder: 'Escribe tu consulta SQL o explicación.',
    required: true,
    rubricHint: 'SELECT * FROM clientes WHERE activo = TRUE (o activo = 1); índice en activo o (activo, id).'
  },
  {
    id: 'q9',
    section: '3. Bases de datos',
    points: 5,
    title: '9. La aplicación comienza a crear clientes con el mismo correo varias veces. Además de corregir el código, ¿qué mecanismo aplicarías en la base de datos para ayudar a impedir duplicados?',
    type: 'textarea',
    placeholder: 'Describe el mecanismo a nivel de base de datos.',
    required: true,
    rubricHint: 'Restricción de unicidad (UNIQUE constraint) o índice único (UNIQUE INDEX) sobre la columna email (ej. UNIQUE(LOWER(email))).'
  },

  // 4. Troubleshooting (15 pts)
  {
    id: 'q10',
    section: '4. Troubleshooting',
    points: 8,
    title: '10. Una integración procesa ~500 registros diarios. Algunos devuelven 500 Internal Server Error y ocasionalmente 429 Too Many Requests. ¿Cómo investigarías el problema y qué información buscarías en logs?',
    type: 'textarea',
    placeholder: 'Detalla tu plan de investigación y búsqueda en logs.',
    required: true,
    rubricHint: 'Para 429: buscar límites de rate limit, header Retry-After, concurrencia o picos de peticiones. Para 500: correlation ID, stack trace, timeouts, payloads específicos que fallan. Implementar backoff exponencial y limitación de tasa (rate limiter).'
  },
  {
    id: 'q11',
    section: '4. Troubleshooting',
    points: 7,
    title: '11. Un cliente reporta: A) un reporte tarda 15 segundos; B) algunas facturas se crean dos veces; C) quiere cambiar el color de un botón. ¿En qué orden investigarías y por qué?',
    type: 'textarea',
    placeholder: 'Indica el orden y justifica tu razonamiento.',
    required: true,
    rubricHint: 'Orden: B -> A -> C. Justificación: B compromete la integridad financiera y legal de la empresa (duplicación de cobros). A es un problema de rendimiento que afecta productividad pero no corrompe datos. C es cosmético/menor.'
  },

  // 5. Caso práctico (20 pts)
  {
    id: 'q12',
    section: '5. Caso práctico',
    points: 20,
    title: '12. Diseña una integración empresarial completa.',
    type: 'textarea',
    placeholder: 'Desarrolla tu solución cubriendo todos los aspectos solicitados.',
    required: true,
    rubricHint: 'Evaluar: 1. Flujo claro paso a paso. 2. Manejo de estados parciales y fallos intermedios. 3. Idempotencia y prevención de duplicados. 4. Almacenamiento seguro de tokens/secretos. 5. Trazabilidad/logging estructurado. 6. Decisión técnica con pros y contras fundamentados.'
  },

  // 6. Inglés técnico (5 pts)
  {
    id: 'q13',
    section: '6. Inglés técnico',
    points: 5,
    title: '13. Lee el fragmento y explica en español qué ocurre después de una hora, qué debería hacer la aplicación y qué ocurre si el refresh token deja de ser válido.',
    codeSnippet: 'The access token expires after one hour. When the token expires, the client application must request a new access token using the refresh token. If the refresh token is invalid, the user must authenticate again.',
    type: 'textarea',
    placeholder: 'Explica en español los 3 puntos.',
    required: true,
    rubricHint: '1. El access token expira tras 1 hora. 2. La app debe solicitar uno nuevo usando el refresh token. 3. Si el refresh token no es válido, el usuario debe volver a autenticarse (login).'
  },

  // 7. Experiencia técnica (No puntuable)
  {
    id: 'q14',
    section: '7. Experiencia técnica',
    points: 0,
    title: '14. Indica qué tecnologías has utilizado y en qué contexto.',
    type: 'textarea',
    placeholder: 'REST APIs, OAuth 2.0, Webhooks, Python, JavaScript/TypeScript, SQL, PostgreSQL/MySQL, Git/GitHub, Docker, n8n, Zoho CRM, Zoho Creator, Zoho Books, Zoho Flow, Deluge, APIs de IA u otras.',
    required: false
  }
];

// Perfil de Estilo de Trabajo - 30 Likert Questions (1 to 5)
export interface WorkStyleStatement {
  id: number;
  dimensionCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  dimensionName: string;
  statement: string;
  isReverse: boolean;
}

export const WORK_STYLE_DIMENSIONS = {
  A: { code: 'A', name: 'Responsabilidad y ejecución', shortName: 'Responsabilidad y ejecución', description: 'Mide organización, seguimiento, atención al detalle y capacidad de terminar compromisos.' },
  B: { code: 'B', name: 'Resolución estructurada de problemas', shortName: 'Resolución de problemas', description: 'Mide la tendencia a investigar, aislar causas y validar antes de modificar sistemas.' },
  C: { code: 'C', name: 'Aprendizaje y adaptabilidad', shortName: 'Aprendizaje y adaptabilidad', description: 'Mide disposición para aprender tecnologías, cambiar enfoques y trabajar fuera de herramientas conocidas.' },
  D: { code: 'D', name: 'Colaboración y comunicación', shortName: 'Colaboración y comunicación', description: 'Mide intercambio de información, capacidad de solicitar ayuda y comunicación con perfiles técnicos y no técnicos.' },
  E: { code: 'E', name: 'Autonomía y ownership', shortName: 'Autonomía y ownership', description: 'Mide iniciativa, responsabilidad sobre resultados y capacidad de avanzar con supervisión razonable.' },
  F: { code: 'F', name: 'Manejo de ambigüedad y criterio', shortName: 'Manejo de ambigüedad', description: 'Mide la capacidad de trabajar cuando los requisitos no están completamente definidos y de identificar cuándo debe solicitarse aclaración.' }
} as const;

export const REVERSE_SCORED_ITEMS = new Set([4, 9, 14, 19, 24, 29]);

export const WORK_STYLE_STATEMENTS: WorkStyleStatement[] = [
  // A. Responsabilidad y ejecución (1-5)
  {
    id: 1,
    dimensionCode: 'A',
    dimensionName: 'Responsabilidad y ejecución',
    statement: 'Cuando acepto una tarea, procuro darle seguimiento hasta comprobar que quedó completamente terminada.',
    isReverse: false
  },
  {
    id: 2,
    dimensionCode: 'A',
    dimensionName: 'Responsabilidad y ejecución',
    statement: 'Antes de considerar un trabajo terminado, reviso los detalles que podrían generar errores posteriormente.',
    isReverse: false
  },
  {
    id: 3,
    dimensionCode: 'A',
    dimensionName: 'Responsabilidad y ejecución',
    statement: 'Si tengo varias tareas simultáneas, establezco prioridades y llevo algún tipo de control de lo pendiente.',
    isReverse: false
  },
  {
    id: 4,
    dimensionCode: 'A',
    dimensionName: 'Responsabilidad y ejecución',
    statement: 'A veces considero suficiente entregar una solución aunque queden pequeños problemas sin resolver.',
    isReverse: true
  },
  {
    id: 5,
    dimensionCode: 'A',
    dimensionName: 'Responsabilidad y ejecución',
    statement: 'Si descubro que cometí un error, prefiero comunicarlo y corregirlo antes de que otra persona lo encuentre.',
    isReverse: false
  },

  // B. Resolución estructurada de problemas (6-10)
  {
    id: 6,
    dimensionCode: 'B',
    dimensionName: 'Resolución estructurada de problemas',
    statement: 'Cuando algo deja de funcionar, primero intento entender la causa antes de hacer cambios.',
    isReverse: false
  },
  {
    id: 7,
    dimensionCode: 'B',
    dimensionName: 'Resolución estructurada de problemas',
    statement: 'Me resulta natural dividir un problema complejo en problemas más pequeños.',
    isReverse: false
  },
  {
    id: 8,
    dimensionCode: 'B',
    dimensionName: 'Resolución estructurada de problemas',
    statement: 'Si encuentro una solución que aparentemente funciona, normalmente trato de comprobar por qué funcionó.',
    isReverse: false
  },
  {
    id: 9,
    dimensionCode: 'B',
    dimensionName: 'Resolución estructurada de problemas',
    statement: 'Cuando tengo poco tiempo, prefiero probar varias cosas rápidamente aunque no conozca todavía la causa del problema.',
    isReverse: true
  },
  {
    id: 10,
    dimensionCode: 'B',
    dimensionName: 'Resolución estructurada de problemas',
    statement: 'Cuando dos sistemas muestran resultados diferentes, intento identificar dónde se origina la diferencia antes de decidir cuál está incorrecto.',
    isReverse: false
  },

  // C. Aprendizaje y adaptabilidad (11-15)
  {
    id: 11,
    dimensionCode: 'C',
    dimensionName: 'Aprendizaje y adaptabilidad',
    statement: 'Me resulta estimulante trabajar con una tecnología que todavía no domino.',
    isReverse: false
  },
  {
    id: 12,
    dimensionCode: 'C',
    dimensionName: 'Aprendizaje y adaptabilidad',
    statement: 'Cuando una herramienta nueva puede resolver mejor un problema, estoy dispuesto a abandonar una solución que ya conozco.',
    isReverse: false
  },
  {
    id: 13,
    dimensionCode: 'C',
    dimensionName: 'Aprendizaje y adaptabilidad',
    statement: 'Si no sé cómo resolver algo, normalmente investigo y pruebo antes de asumir que otra persona debe resolverlo.',
    isReverse: false
  },
  {
    id: 14,
    dimensionCode: 'C',
    dimensionName: 'Aprendizaje y adaptabilidad',
    statement: 'Prefiero trabajar únicamente con tecnologías que ya conozco bien.',
    isReverse: true
  },
  {
    id: 15,
    dimensionCode: 'C',
    dimensionName: 'Aprendizaje y adaptabilidad',
    statement: 'Cuando recibo feedback técnico que contradice mi enfoque inicial, puedo reconsiderar mi solución.',
    isReverse: false
  },

  // D. Colaboración y comunicación (16-20)
  {
    id: 16,
    dimensionCode: 'D',
    dimensionName: 'Colaboración y comunicación',
    statement: 'Si una decisión técnica puede afectar a otras personas del proyecto, considero importante explicar sus consecuencias.',
    isReverse: false
  },
  {
    id: 17,
    dimensionCode: 'D',
    dimensionName: 'Colaboración y comunicación',
    statement: 'Cuando estoy bloqueado durante demasiado tiempo, prefiero pedir apoyo antes que continuar avanzando sin dirección.',
    isReverse: false
  },
  {
    id: 18,
    dimensionCode: 'D',
    dimensionName: 'Colaboración y comunicación',
    statement: 'Puedo adaptar mi explicación dependiendo de si estoy hablando con un desarrollador, un usuario o un gerente.',
    isReverse: false
  },
  {
    id: 19,
    dimensionCode: 'D',
    dimensionName: 'Colaboración y comunicación',
    statement: 'Normalmente prefiero resolver los problemas completamente por mi cuenta aunque otro miembro del equipo pueda ayudar.',
    isReverse: true
  },
  {
    id: 20,
    dimensionCode: 'D',
    dimensionName: 'Colaboración y comunicación',
    statement: 'Si no estoy de acuerdo con una decisión técnica, puedo plantear mi posición sin convertir la discusión en un conflicto personal.',
    isReverse: false
  },

  // E. Autonomía y ownership (21-25)
  {
    id: 21,
    dimensionCode: 'E',
    dimensionName: 'Autonomía y ownership',
    statement: 'Cuando recibo un objetivo claro, puedo organizar por mi cuenta las acciones necesarias para alcanzarlo.',
    isReverse: false
  },
  {
    id: 22,
    dimensionCode: 'E',
    dimensionName: 'Autonomía y ownership',
    statement: 'Si detecto un problema que puede afectar el proyecto, considero parte de mi responsabilidad comunicarlo aunque no me lo hayan solicitado.',
    isReverse: false
  },
  {
    id: 23,
    dimensionCode: 'E',
    dimensionName: 'Autonomía y ownership',
    statement: 'Si una tarea depende de otra persona, hago seguimiento en lugar de asumir que eventualmente se resolverá.',
    isReverse: false
  },
  {
    id: 24,
    dimensionCode: 'E',
    dimensionName: 'Autonomía y ownership',
    statement: 'Prefiero esperar instrucciones específicas antes de realizar cualquier actividad que no haya sido asignada directamente.',
    isReverse: true
  },
  {
    id: 25,
    dimensionCode: 'E',
    dimensionName: 'Autonomía y ownership',
    statement: 'Cuando algo que implementé falla, me concentro primero en resolver el problema antes que en determinar quién tuvo la culpa.',
    isReverse: false
  },

  // F. Manejo de ambigüedad y criterio (26-30)
  {
    id: 26,
    dimensionCode: 'F',
    dimensionName: 'Manejo de ambigüedad y criterio',
    statement: 'Puedo comenzar a estructurar una solución aunque todavía existan algunos requisitos por definir.',
    isReverse: false
  },
  {
    id: 27,
    dimensionCode: 'F',
    dimensionName: 'Manejo de ambigüedad y criterio',
    statement: 'Cuando un requerimiento es ambiguo, intento identificar los supuestos antes de comenzar a desarrollar.',
    isReverse: false
  },
  {
    id: 28,
    dimensionCode: 'F',
    dimensionName: 'Manejo de ambigüedad y criterio',
    statement: 'Si existen varias soluciones técnicamente válidas, comparo ventajas, riesgos y mantenimiento antes de elegir.',
    isReverse: false
  },
  {
    id: 29,
    dimensionCode: 'F',
    dimensionName: 'Manejo de ambigüedad y criterio',
    statement: 'Me resulta incómodo avanzar si no tengo absolutamente toda la información disponible.',
    isReverse: true
  },
  {
    id: 30,
    dimensionCode: 'F',
    dimensionName: 'Manejo de ambigüedad y criterio',
    statement: 'Si una solicitud del cliente puede generar consecuencias técnicas importantes, prefiero aclararla antes de implementarla literalmente.',
    isReverse: false
  }
];

// Helper to compute Work Style scores
export function calculateWorkStyleScores(responses: Record<number, number>): {
  dimensionScores: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>;
  consistencyFlags: {
    hasFlag: boolean;
    allIdentical: boolean;
    extremeResponses: boolean;
    contradictoryItems: boolean;
    message?: string;
  };
} {
  const dimensionTotals: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0
  };

  WORK_STYLE_STATEMENTS.forEach(stmt => {
    let raw = responses[stmt.id] || 3;
    if (stmt.isReverse) {
      // 1 -> 5, 2 -> 4, 3 -> 3, 4 -> 2, 5 -> 1
      raw = 6 - raw;
    }
    dimensionTotals[stmt.dimensionCode] += raw;
  });

  const dimensionScores: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
    A: Math.round((dimensionTotals.A / 25) * 100),
    B: Math.round((dimensionTotals.B / 25) * 100),
    C: Math.round((dimensionTotals.C / 25) * 100),
    D: Math.round((dimensionTotals.D / 25) * 100),
    E: Math.round((dimensionTotals.E / 25) * 100),
    F: Math.round((dimensionTotals.F / 25) * 100)
  };

  // Consistency checks
  const values = Object.values(responses);
  const allIdentical = values.length >= 25 && values.every(v => v === values[0]);
  const extremeResponses = values.length >= 25 && values.every(v => v === 1 || v === 5);

  // Check contradictions: e.g. Q1 is 5 and Q4 is 5 raw (Q4 reverse means 1, so direct vs reverse conflict)
  const contradictoryItems = (
    (responses[1] >= 4 && responses[4] >= 4) ||
    (responses[6] >= 4 && responses[9] >= 4) ||
    (responses[11] >= 4 && responses[14] >= 4) ||
    (responses[16] >= 4 && responses[19] >= 4) ||
    (responses[21] >= 4 && responses[24] >= 4) ||
    (responses[26] >= 4 && responses[29] >= 4)
  );

  const hasFlag = allIdentical || extremeResponses || contradictoryItems;

  return {
    dimensionScores,
    consistencyFlags: {
      hasFlag,
      allIdentical,
      extremeResponses,
      contradictoryItems,
      message: hasFlag ? 'Revisar durante entrevista' : undefined
    }
  };
}

// Generate 2-4 STAR interview questions based on dimensions
export function generateStarQuestions(scores: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>): {
  dimension: string;
  focus: string;
  question: string;
  method: string;
}[] {
  const questions: { dimension: string; focus: string; question: string; method: string }[] = [];

  // Dimension A
  if (scores.A < 70) {
    questions.push({
      dimension: 'Responsabilidad y ejecución',
      focus: 'Gestión de prioridades y seguimiento',
      question: 'Cuéntame sobre una ocasión en la que manejaste simultáneamente varias tareas técnicas críticas. ¿Cómo definiste las prioridades y qué método utilizaste para verificar que no quedaran detalles pendientes?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  } else if (scores.A >= 85) {
    questions.push({
      dimension: 'Responsabilidad y ejecución',
      focus: 'Atención al detalle y control de calidad',
      question: 'Descríbeme una situación en la que detectaste un detalle o error técnico antes de pasar a producción que nadie más había notado. ¿Cómo procediste y cuál fue el resultado final?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  }

  // Dimension B
  if (scores.B >= 80) {
    questions.push({
      dimension: 'Resolución de problemas',
      focus: 'Análisis de causa raíz en incidentes',
      question: 'Cuéntame un caso en el que te enfrentaste a un fallo intermitente o sin causa aparente en un sistema en producción. ¿Cuál fue tu proceso paso a paso para aislar la causa raíz antes de realizar cambios?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  } else if (scores.B < 70) {
    questions.push({
      dimension: 'Resolución de problemas',
      focus: 'Resolución bajo presión de tiempo',
      question: 'Describe una situación donde tenías presión extrema de tiempo para solucionar una caída de servicio. ¿Cómo balanceaste la rapidez de respuesta con la necesidad de entender la causa raíz?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  }

  // Dimension C
  if (scores.C >= 80) {
    questions.push({
      dimension: 'Aprendizaje y adaptabilidad',
      focus: 'Adopción de nuevas tecnologías',
      question: 'Descríbeme una situación en la que tuviste que implementar una solución con una tecnología, lenguaje o API que nunca antes habías utilizado. ¿Cómo abordaste la curva de aprendizaje y cuál fue el resultado?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  } else if (scores.C < 70) {
    questions.push({
      dimension: 'Aprendizaje y adaptabilidad',
      focus: 'Recepción de feedback técnico',
      question: 'Cuéntame sobre una ocasión en que un code review o un compañero cuestionó profundamente una solución técnica que habías propuesto. ¿Cómo gestionaste ese intercambio y cuál fue la solución acordada?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  }

  // Dimension D
  if (scores.D >= 75) {
    questions.push({
      dimension: 'Colaboración y comunicación',
      focus: 'Comunicación técnica con áreas no técnicas',
      question: 'Cuéntame una experiencia en la que debiste explicar una decisión de arquitectura compleja o una limitación de API a un cliente o gerente sin perfil técnico. ¿Cómo adaptaste tu mensaje y cuál fue el desenlace?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  }

  // Dimension E
  if (scores.E >= 80) {
    questions.push({
      dimension: 'Autonomía y ownership',
      focus: 'Iniciativa proactiva',
      question: 'Cuéntame un caso en el que identificaste un problema o riesgo que técnicamente no era tu responsabilidad directa pero decidiste intervenir. ¿Qué acciones tomaste y qué impacto tuvo en el proyecto?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  } else if (scores.E < 70) {
    questions.push({
      dimension: 'Autonomía y ownership',
      focus: 'Gestión de dependencias externas',
      question: 'Describe una situación en la que tu entrega dependía completamente del trabajo de un proveedor externo o de otro equipo. ¿Cómo diste seguimiento para evitar atrasos?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  }

  // Dimension F
  if (scores.F < 70) {
    questions.push({
      dimension: 'Manejo de ambigüedad',
      focus: 'Desarrollo con requisitos incompletos',
      question: 'Descríbeme una situación en la que tuviste que comenzar a desarrollar un módulo antes de tener todas las especificaciones o contratos de API definidos. ¿Qué supuestos estableciste y cómo avanzaste?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  } else if (scores.F >= 80) {
    questions.push({
      dimension: 'Manejo de ambigüedad',
      focus: 'Evaluación de alternativas arquitectónicas',
      question: 'Cuéntame sobre una decisión donde existían dos o más alternativas técnicas válidas con diferentes ventajas y riesgos. ¿Qué criterios utilizaste para seleccionar una y qué resultado obtuviste?',
      method: 'STAR (Situación, Tarea, Acción, Resultado)'
    });
  }

  // Return 2 to 4 questions
  return questions.slice(0, 4);
}

// Observed tendencies description (Strictly non-clinical, behavioral only)
export function getDimensionTendency(dimensionCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F', score: number): string {
  switch (dimensionCode) {
    case 'A':
      return score >= 75
        ? 'Mayor preferencia por trabajo estructurado, rigor en detalles y seguimiento metódico de compromisos.'
        : 'Mayor tendencia a priorizar entregas rápidas con posible oportunidad de profundizar en verificación final.';
    case 'B':
      return score >= 75
        ? 'Tendencia marcada hacia la investigación sistemática de causa raíz antes de alterar código.'
        : 'Preferencia declarada por exploración empírica y prueba rápida de hipótesis en situaciones de presión.';
    case 'C':
      return score >= 75
        ? 'Alta disposición declarada hacia aprendizaje activo y adopción de herramientas novedosas.'
        : 'Preferencia por operar dentro de marcos tecnológicos familiares y probados.';
    case 'D':
      return score >= 75
        ? 'Facilidad declarada para la comunicación interdisciplinaria y búsqueda oportuna de consenso.'
        : 'Preferencia declarada por resolución individual con espacio para potenciar comunicación preventiva.';
    case 'E':
      return score >= 75
        ? 'Preferencia declarada por autonomía en la ejecución y sentido proactivo de ownership del proyecto.'
        : 'Mayor comodidad trabajando con pautas detalladas y directrices operativas predefinidas.';
    case 'F':
      return score >= 75
        ? 'Alta capacidad declarada para estructurar soluciones ante escenarios ambiguos o requisitos evolutivos.'
        : 'Menor preferencia por trabajar con requisitos incompletos; mayor necesidad de especificación previa.';
  }
}
