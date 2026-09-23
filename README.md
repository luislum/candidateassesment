# RESET Candidate Assessment

Assessment técnico y de estilo de trabajo para el proceso de selección de RESET.

## Arquitectura actual

```
Administrador RESET
   ↓ Google Sign-In (Firebase Auth)
Vercel / React
   ↓
Firebase Firestore
   ├─ invitations
   ├─ candidates
   ├─ assessment_sessions
   ├─ assessment_answers
   ├─ integrity_events
   └─ work_style_assessments
```

> Nota: el repositorio ya no usa Neon para la persistencia de esta versión. El README anterior quedó desalineado después de la migración a Firebase.

## Flujo E2E

1. El administrador entra con Google al panel administrativo.
2. Genera una invitación individual con nombre, correo, variante y fecha de expiración.
3. Firestore crea el registro de `invitations` y el candidato.
4. El sistema genera un link `?token=inv_...`.
5. El candidato abre el link y la app valida:
   - existencia;
   - expiración;
   - estado;
   - reanudación local si ya había empezado.
6. Al comenzar se crea `assessment_sessions` y la invitación pasa a `in_progress`.
7. Durante la Parte 1:
   - las respuestas se guardan periódicamente;
   - se actualiza el tiempo y la telemetría;
   - se registran eventos de integridad;
   - el navegador conserva estado local para recuperación tras recarga.
8. Al completar la Parte 1, la sesión y todas las respuestas se guardan en un único batch de Firestore.
9. La Parte 2 guarda las 30 respuestas de estilo de trabajo y marca la invitación como `completed` en un único batch.
10. El administrador revisa respuestas, eventos y resultados desde el dashboard.

## Seguridad administrativa

El panel **no usa claves hardcodeadas en JavaScript**.

El acceso administrativo requiere Firebase Authentication con Google y debe coincidir con las reglas de Firestore:

- `l.lum@reset-corp.com`; o
- un usuario cuyo UID exista en la colección `admins`.

Para que Google Sign-In funcione en producción, agrega los dominios usados por la aplicación en:

`Firebase Console → Authentication → Settings → Authorized domains`

Incluye como mínimo:

```
candidateassesment.vercel.app
```

y cualquier dominio personalizado que se conecte después.

## Firestore

La aplicación usa el proyecto y database ID definidos en:

```
firebase-applet-config.json
```

Las reglas esperadas están en:

```
firestore.rules
```

Estas reglas deben estar desplegadas en el mismo Firestore database que usa la aplicación.

## Persistencia y recuperación

La Parte 1 hace autosave aproximadamente cada 25 segundos. Además, el navegador conserva localmente:

- `sessionId`;
- fase actual;
- respuestas técnicas;
- respuestas de estilo de trabajo;
- contadores de integridad;
- timestamp de inicio de Parte 1;
- timestamp de inicio de Parte 2.

Al recargar el navegador se conserva el tiempo real transcurrido; el temporizador no vuelve a cero.

Una invitación que ya está `in_progress` no puede iniciarse desde otro navegador sin el estado local correspondiente. Esto evita sesiones duplicadas para un mismo link.

## Scoring

El candidato guarda respuestas crudas, no puntajes técnicos.

El puntaje objetivo de Q1 y los puntajes manuales se calculan/guardan desde el panel administrativo autenticado. Esto evita que el navegador del candidato pueda autoasignarse un score y mantiene compatibilidad con las reglas de Firestore.

## Colecciones

- `invitations`: link individual, candidato, variante, expiración y estado.
- `candidates`: datos básicos del candidato.
- `assessment_sessions`: sesión técnica, tiempo y contadores.
- `assessment_answers`: respuestas Q1–Q14.
- `integrity_events`: copy, cut, paste, pérdida de foco, pestaña oculta, fullscreen, etc.
- `work_style_assessments`: respuestas y resultados del perfil de estilo de trabajo.

## Deploy

El repositorio está conectado al proyecto Vercel `digital-reset/candidateassesment`.

Cada push a `main` dispara un deployment. El estado del deployment puede verificarse desde GitHub en el check `Vercel`.

## Validación mínima después de cada cambio

1. Abrir `/?admin=true`.
2. Autenticarse con una cuenta administradora.
3. Crear una invitación de prueba.
4. Copiar y abrir el link en una ventana privada.
5. Iniciar el assessment.
6. Responder al menos una pregunta y recargar para verificar recuperación y timer.
7. Completar Q1–Q14.
8. Completar las 30 afirmaciones de estilo de trabajo.
9. Confirmar pantalla final.
10. Volver al dashboard y verificar:
    - invitación = `completed`;
    - sesión = `submitted`;
    - 14 documentos de respuestas;
    - un documento de estilo de trabajo;
    - eventos de integridad.
