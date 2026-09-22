# RESET Candidate Assessment

Assessment técnico para el proceso de selección de RESET.

## Arquitectura

```
Candidato
   ↓
Vercel (index.html + /api/submit)
   ↓
Neon PostgreSQL
   ↓
candidate_assessment_db
```

El candidato no necesita cuenta de Google, Zoho ni Neon. Toda la persistencia ocurre servidor a servidor.

## Base de datos

Base independiente:

```
candidate_assessment_db
```

Tablas:

- `candidates`
- `assessment_sessions`
- `assessment_answers`
- `integrity_events`
- `ai_analysis`

La base del Linktree de RESET permanece separada en `neondb`.

## Variable de entorno de Vercel

En **Vercel > candidateassesment > Settings > Environment Variables** configurar:

```
DATABASE_URL=<connection string de candidate_assessment_db>
```

Aplicar a Production, Preview y Development y luego hacer Redeploy.

No guardar `DATABASE_URL` en GitHub ni en código fuente.

Las variables antiguas ya no son necesarias:

- `APPS_SCRIPT_URL`
- `ASSESSMENT_SHARED_SECRET`

## Health check

Después del deploy:

```
https://TU-DOMINIO/api/submit
```

Debe responder aproximadamente:

```json
{
  "ok": true,
  "configured": true,
  "service": "RESET Assessment API",
  "storage": "Neon PostgreSQL",
  "database": "candidate_assessment_db"
}
```

## Persistencia

`session_start`, `checkpoint` y `submit` actualizan la sesión.

Las respuestas se guardan de forma incremental mediante upsert y los eventos de integridad usan `event_id` para evitar duplicados.

## Datos registrados

- q1–q14
- hora de inicio y entrega
- tiempo transcurrido
- copy / cut / paste como eventos
- pérdida de foco
- cambio de pestaña / página oculta
- salida de pantalla completa
- navegador, idioma, zona horaria y resolución

Los eventos de foco son señales contextuales; no constituyen por sí solos prueba de uso de asistencia externa.

No se graba audio ni video y no se capturan imágenes.

## Zoho Recruit / Gemini

El esquema ya contempla:

- `zoho_candidate_id`
- `zoho_job_id`
- tabla `ai_analysis` en JSONB

Esto permitirá posteriormente relacionar el assessment con el perfil, CV y Job Opening de Zoho Recruit y guardar análisis técnico estructurado generado por Gemini.
