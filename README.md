# RESET Assess — HTML + Google Sheets

MVP para el Assessment Técnico de Ingeniero en Desarrollo de Software.

## Qué registra
- Respuestas q1–q14
- Hora de inicio y entrega
- Tiempo total
- Copy / Cut / Paste (solo el evento, NO el contenido del portapapeles)
- Pérdida de foco
- Cambio de pestaña / página oculta
- Salida de pantalla completa
- Progreso/checkpoints

No toma fotografías, no graba video ni audio.

## 1. Crear la base en Google Sheets
1. Crea un Google Sheet nuevo, por ejemplo: `RESET Assessments`.
2. En ese Sheet: **Extensions > Apps Script**.
3. Borra el contenido inicial y pega `Code.gs`.
4. Guarda.
5. Ejecuta manualmente la función `setup()` una sola vez.
6. Google pedirá autorización. Autoriza con la cuenta de RESET.

`setup()` crea automáticamente:
- `Sessions`
- `Answers`
- `Events`

## 2. Publicar Apps Script como Web App
1. En Apps Script: **Deploy > New deployment**.
2. Tipo: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy.
6. Copia la URL que termina en `/exec`.

## 3. Configurar el HTML
En `index.html`, busca:

```js
endpoint: "PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
```

y reemplázala por tu URL `/exec`.

## 4. Subir a GitHub / Vercel
Este proyecto es HTML estático:
- sube `index.html` y `vercel.json` al repo;
- Vercel puede desplegarlo sin framework;
- opcionalmente asigna `assessment.reset-corp.com`.

## 5. Link por candidato
El HTML permite prellenar nombre y email con query parameters:

`https://TU-DOMINIO/?name=Andrea%20Velasco&email=correo@ejemplo.com`

El candidato todavía debe aceptar la declaración de integridad.

## Importante sobre eventos
`visibilitychange` y `blur` permiten saber que el assessment dejó de estar visible o perdió foco. El navegador NO puede afirmar de manera fiable qué aplicación, pestaña o ventana específica abrió el candidato.

Los eventos de integridad deben revisarse como contexto, no como prueba automática de fraude. Un cambio de foco también puede ocurrir por una notificación, un diálogo del sistema o accesibilidad.

## Puntuación
La pregunta q1 se puntúa automáticamente en Apps Script (4/4).
Las preguntas abiertas se revisan con la rúbrica técnica de RESET.
