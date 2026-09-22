# RESET Assess — Vercel + Google Sheets

MVP para el Assessment Técnico de Ingeniero en Desarrollo de Software.

## Arquitectura

```
Candidato
   ↓
Vercel (index.html)
   ↓
/api/submit (Serverless Function)
   ↓  agrega secreto privado
Google Apps Script
   ↓
Google Sheets
```

El candidato puede usar **cualquier correo electrónico**. No necesita Gmail ni una Cuenta de Google.

## Seguridad

El navegador nunca recibe:
- la URL de Google Apps Script;
- `ASSESSMENT_SHARED_SECRET`;
- permisos sobre Google Sheets.

Apps Script debe desplegarse con acceso **Anyone** para permitir la llamada servidor-a-servidor desde Vercel, pero cada POST es rechazado si no contiene el secreto que Vercel agrega internamente.

## Google Apps Script

1. Abre el Google Sheet de assessments.
2. **Extensions > Apps Script**.
3. Reemplaza `Code.gs` por la versión de este repositorio.
4. Ejecuta `setup()` una vez.
5. En **Project Settings > Script Properties** crea:
   - `ASSESSMENT_SHARED_SECRET`
6. Deploy > Manage deployments > Edit/New deployment.
7. Tipo: **Web app**.
8. Execute as: **Me**.
9. Who has access: **Anyone**.
10. Copia la URL que termina en `/exec`.

## Variables de entorno de Vercel

En **Vercel > Project > Settings > Environment Variables** crea:

- `APPS_SCRIPT_URL` = URL `/exec` de Apps Script.
- `ASSESSMENT_SHARED_SECRET` = exactamente el mismo valor guardado en Apps Script.

Aplica las variables a Production, Preview y Development y luego redeploy.

## Qué registra

- Respuestas q1–q14
- Hora de inicio y entrega
- Tiempo total
- Copy / Cut / Paste (solo el evento)
- Pérdida de foco
- Cambio de pestaña/página oculta
- Salida de pantalla completa
- Progreso/checkpoints

No graba audio ni video y no captura imágenes.

## Hojas

`setup()` crea:
- `Sessions`
- `Answers`
- `Events`

## Links por candidato

Se puede prellenar nombre y correo:

```
https://TU-DOMINIO/?name=Andrea%20Velasco&email=correo@ejemplo.com
```

El candidato debe aceptar la declaración de integridad antes de iniciar.

## Integridad

Los eventos de foco son señales contextuales, no prueba automática de fraude. El navegador puede perder foco por notificaciones, diálogos del sistema o herramientas de accesibilidad.
