import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, Eye, Lock, LogOut, Plus, RefreshCw } from 'lucide-react';
import { PRACTICAL_CASE, TECHNICAL_QUESTIONS, WORK_STYLE_DIMENSIONS, WORK_STYLE_STATEMENTS } from '../data/questions';

interface Props {
  onOpenCandidateLink: (token: string) => void;
}

interface AssessmentRow {
  session_id: string;
  status: string;
  version: string;
  candidate_id: string | number;
  candidate_name: string;
  candidate_email: string;
  started_at?: string;
  submitted_at?: string;
  elapsed_seconds?: number;
  technical_answer_count?: number;
  work_style_answer_count?: number;
}

const CODE_KEY = 'reset_admin_code';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function adminRequest(code: string, body: any) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Code': code
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || ('HTTP ' + response.status));
  }
  return data;
}

export const SimpleAdminDashboard: React.FC<Props> = ({ onOpenCandidateLink }) => {
  const [adminCode, setAdminCode] = useState(() => sessionStorage.getItem(CODE_KEY) || '');
  const [codeInput, setCodeInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [selected, setSelected] = useState<AssessmentRow | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const sorted = useMemo(
    () => [...assessments].sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()),
    [assessments]
  );

  const refresh = async (code = adminCode) => {
    if (!code) return;
    setLoading(true);
    try {
      const data = await adminRequest(code, { action: 'list' });
      setAssessments(data.assessments || []);
      setAuthenticated(true);
      setAuthError('');
    } catch (error: any) {
      setAuthenticated(false);
      setAuthError(error.message || 'No se pudo acceder al dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminCode) void refresh(adminCode);
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeInput.trim();
    if (!code) return;

    setLoading(true);
    try {
      const data = await adminRequest(code, { action: 'list' });
      sessionStorage.setItem(CODE_KEY, code);
      setAdminCode(code);
      setAssessments(data.assessments || []);
      setAuthenticated(true);
      setAuthError('');
      setCodeInput('');
    } catch (error: any) {
      setAuthError(error.message || 'Código incorrecto.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(CODE_KEY);
    setAdminCode('');
    setAuthenticated(false);
    setAssessments([]);
    setSelected(null);
    setDetail(null);
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim()) return;
    const normalizedEmail = candidateEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      alert('Ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    try {
      const data = await adminRequest(adminCode, {
        action: 'create_invite',
        candidateName: candidateName.trim(),
        candidateEmail: normalizedEmail
      });

      const link = window.location.origin + window.location.pathname + '?token=' + encodeURIComponent(data.token);
      setGeneratedLink(link);
      await refresh(adminCode);
    } catch (error: any) {
      alert(error.message || 'No se pudo generar la evaluación.');
    } finally {
      setLoading(false);
    }
  };

  const closeNew = () => {
    setShowNew(false);
    setCandidateName('');
    setCandidateEmail('');
    setGeneratedLink('');
  };

  const openDetail = async (row: AssessmentRow) => {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await adminRequest(adminCode, {
        action: 'detail',
        sessionId: row.session_id
      });
      setDetail(data);
    } catch (error: any) {
      alert(error.message || 'No se pudo cargar la evaluación.');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
        <form onSubmit={login} className="w-full max-w-sm bg-[#101721] border border-[#263241] rounded-2xl p-8 space-y-5 shadow-2xl">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-950/70 border border-blue-800 flex items-center justify-center text-blue-400">
              <Lock size={22} />
            </div>
            <div className="text-xs font-bold tracking-widest text-blue-400">RESET</div>
            <h1 className="text-xl font-bold mt-1">Dashboard Administrativo</h1>
            <p className="text-xs text-slate-400 mt-2">Ingresa el código administrativo.</p>
          </div>

          {authError && (
            <div className="text-xs text-red-300 bg-red-950/30 border border-red-900 rounded-lg p-3">
              {authError}
            </div>
          )}

          <input
            type="password"
            autoFocus
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Código de acceso"
            className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !codeInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3 text-sm font-bold"
          >
            {loading ? 'Validando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    );
  }

  if (selected) {
    const answers: any[] = detail?.answers || [];
    const answerMap = Object.fromEntries(answers.map((a) => [a.question_id, a.answer]));
    const events: any[] = detail?.events || [];
    let dimensions: any = null;
    try {
      dimensions = answerMap.ws_dimensions ? JSON.parse(answerMap.ws_dimensions) : null;
    } catch {}

    const buildLlmExport = () => {
      const assessment = detail?.assessment || selected;
      const eventCounts = events.reduce((acc: Record<string, number>, event: any) => {
        const key = event.event_type || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const technical = TECHNICAL_QUESTIONS.map((q) => {
        const practicalCase = q.id === 'q12'
          ? [
              '',
              'CASO PRÁCTICO:',
              PRACTICAL_CASE.scenario,
              ...PRACTICAL_CASE.requirements,
              'Criterios adicionales del caso: ' + PRACTICAL_CASE.evaluationCriteria
            ].join('\n')
          : '';

        return [
          '------------------------------------------------------------',
          q.title,
          'Sección: ' + q.section,
          'Puntaje máximo: ' + q.points,
          q.codeSnippet ? 'Contexto / código:\n' + q.codeSnippet : '',
          practicalCase,
          'RESPUESTA DEL CANDIDATO:',
          answerMap[q.id] || '[Sin respuesta]',
          q.rubricHint ? 'RÚBRICA / RESPUESTA ESPERADA:\n' + q.rubricHint : 'RÚBRICA: No aplica / pregunta descriptiva.'
        ].filter(Boolean).join('\n');
      }).join('\n\n');

      const dimensionDefinitions = Object.values(WORK_STYLE_DIMENSIONS)
        .map((dimension) => '- ' + dimension.code + ' · ' + dimension.name + ': ' + dimension.description)
        .join('\n');

      const workStyle = WORK_STYLE_STATEMENTS.map((item) => [
        item.id + '. [' + item.dimensionCode + ' · ' + item.dimensionName + ']',
        item.statement,
        'Respuesta (1-5): ' + (answerMap['ws' + item.id] || '[Sin respuesta]'),
        'Ítem de puntuación inversa: ' + (item.isReverse ? 'Sí' : 'No')
      ].join('\n')).join('\n\n');

      const integrity = events.length
        ? events.map((event: any, index: number) => [
            (index + 1) + '. ' + (event.event_type || 'evento'),
            'Fecha/hora: ' + (event.occurred_at || ''),
            event.question_id ? 'Pregunta: ' + event.question_id : '',
            event.detail ? 'Detalle: ' + event.detail : ''
          ].filter(Boolean).join(' | ')).join('\n')
        : '[Sin eventos registrados]';

      return [
        'RESET — EXPORTACIÓN DE ASSESSMENT PARA ANÁLISIS CON LLM',
        'Puesto: Ingeniero en Desarrollo de Software / Sistemas',
        '',
        'INSTRUCCIONES PARA EL LLM',
        'Analiza esta evaluación como apoyo al proceso de selección. Basa toda conclusión en evidencia observable de las respuestas.',
        'Para la parte técnica: compara cada respuesta con la rúbrica, propone un puntaje por pregunta hasta su máximo, explica brevemente la evidencia, suma un puntaje técnico sugerido sobre 100 e identifica fortalezas, brechas y preguntas de seguimiento para entrevista.',
        'Para personalidad laboral: interpreta únicamente tendencias de estilo de trabajo relevantes al rol. Es un autoinforme, no una evaluación clínica. No infieras salud mental, discapacidad, religión, raza, orientación sexual, situación familiar ni ningún otro atributo sensible o protegido.',
        'Los eventos de integridad son señales contextuales y no deben tratarse por sí solos como prueba de fraude.',
        'No emitas una decisión automática de contratar/no contratar. Entrega evidencia, riesgos técnicos, áreas por validar y preguntas recomendadas para entrevista.',
        '',
        '============================================================',
        'DATOS DEL CANDIDATO',
        'Nombre: ' + selected.candidate_name,
        'Correo: ' + selected.candidate_email,
        'Session ID: ' + selected.session_id,
        'Estado: ' + selected.status,
        'Inicio: ' + (assessment.started_at || ''),
        'Entrega: ' + (assessment.submitted_at || ''),
        'Tiempo registrado (segundos): ' + (assessment.elapsed_seconds ?? ''),
        '',
        '============================================================',
        'PARTE 1 — EVALUACIÓN TÉCNICA',
        technical,
        '',
        '============================================================',
        'PARTE 2 — PERSONALIDAD LABORAL Y ESTILO DE TRABAJO',
        '',
        'DIMENSIONES EVALUADAS',
        dimensionDefinitions,
        '',
        'RESULTADO CALCULADO POR DIMENSIONES',
        dimensions ? JSON.stringify(dimensions, null, 2) : '[Aún no disponible]',
        '',
        'INDICADOR DE CONSISTENCIA',
        answerMap.ws_consistency || '[Aún no disponible]',
        '',
        'RESPUESTAS CRUDAS DE PERSONALIDAD',
        workStyle,
        '',
        '============================================================',
        'EVENTOS DE INTEGRIDAD',
        'Total de eventos: ' + events.length,
        'Conteo por tipo: ' + JSON.stringify(eventCounts),
        '',
        integrity,
        '',
        '============================================================',
        'FORMATO DE RESPUESTA SUGERIDO PARA EL LLM',
        '1. Resumen técnico ejecutivo.',
        '2. Tabla con Q1–Q14: puntaje sugerido, máximo, evidencia y comentario.',
        '3. Puntaje técnico sugerido total /100.',
        '4. Fortalezas técnicas demostradas.',
        '5. Brechas o riesgos que requieren validación.',
        '6. Interpretación de las seis dimensiones de personalidad laboral.',
        '7. Lectura contextual de eventos de integridad, sin asumir fraude.',
        '8. Entre 5 y 10 preguntas específicas para la entrevista.',
        '9. Aspectos que no pueden concluirse con esta evaluación.'
      ].join('\n');
    };

    const copyForLlm = async () => {
      try {
        await navigator.clipboard.writeText(buildLlmExport());
        alert('Assessment copiado. Ya puedes pegarlo directamente en el LLM.');
      } catch {
        alert('No se pudo copiar automáticamente. Usa Descargar TXT.');
      }
    };

    const downloadForLlm = () => {
      const content = buildLlmExport();
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = selected.candidate_name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
      link.href = url;
      link.download = 'RESET_Assessment_' + (safeName || 'Candidato') + '_LLM.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <button onClick={() => { setSelected(null); setDetail(null); }} className="text-sm text-blue-400 hover:underline">
            ← Volver al dashboard
          </button>

          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6">
            <h1 className="text-2xl font-bold">{selected.candidate_name}</h1>
            <p className="text-sm text-slate-400">{selected.candidate_email}</p>
            <div className="mt-3 text-xs text-slate-500 font-mono">{selected.session_id}</div>
            <div className="mt-2 text-sm text-blue-400 font-semibold">Estado: {selected.status}</div>
            {!detailLoading && detail && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyForLlm}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Copy size={16} /> Copiar para LLM
                </button>
                <button
                  type="button"
                  onClick={downloadForLlm}
                  className="px-4 py-2.5 border border-[#263241] hover:border-slate-500 rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Download size={16} /> Descargar TXT
                </button>
              </div>
            )}
          </div>

          {detailLoading ? (
            <div className="text-slate-400">Cargando desde Neon...</div>
          ) : (
            <>
              <div className="bg-[#101721] border border-[#263241] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#263241] font-bold">Respuestas técnicas</div>
                <div className="divide-y divide-[#263241]">
                  {Array.from({ length: 14 }, (_, index) => {
                    const qid = 'q' + (index + 1);
                    return (
                      <div key={qid} className="p-5">
                        <div className="text-xs font-bold text-blue-400 mb-2">Pregunta {index + 1}</div>
                        <div className="text-sm text-slate-200 whitespace-pre-wrap">{answerMap[qid] || 'Sin respuesta'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-5">
                <div className="font-bold mb-3">Perfil de personalidad laboral</div>
                {selected.work_style_answer_count === 30 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-emerald-400 font-semibold">Completado</div>
                    {dimensions && (
                      <pre className="text-xs bg-[#0a1017] border border-[#263241] rounded-xl p-4 overflow-auto">
                        {JSON.stringify(dimensions, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Aún no completado.</div>
                )}
              </div>

              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-5">
                <div className="font-bold mb-3">Eventos de integridad</div>
                <div className="text-sm text-slate-400">{events.length} eventos registrados.</div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d12] text-[#edf3f8]">
      <header className="border-b border-[#263241] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-lg font-black tracking-widest text-blue-500">RESET</div>
            <div className="text-xs text-slate-400">Candidate Assessment · Neon</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refresh()} className="p-2 border border-[#263241] rounded-lg" title="Actualizar">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-bold flex items-center gap-2">
              <Plus size={16} /> Nueva evaluación
            </button>
            <button onClick={logout} className="p-2 border border-[#263241] rounded-lg" title="Salir">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="bg-[#101721] border border-[#263241] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#263241] flex items-center justify-between">
            <div>
              <h1 className="font-bold">Evaluaciones</h1>
              <p className="text-xs text-slate-500">Datos centralizados en Neon PostgreSQL.</p>
            </div>
            <div className="text-xs text-slate-500">{assessments.length} registros</div>
          </div>

          {sorted.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No hay evaluaciones generadas.</div>
          ) : (
            <div className="divide-y divide-[#263241]">
              {sorted.map((row) => {
                const link = window.location.origin + window.location.pathname + '?token=' + encodeURIComponent(row.session_id);
                return (
                  <div key={row.session_id} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="font-bold">{row.candidate_name}</div>
                      <div className="text-xs text-slate-400">{row.candidate_email}</div>
                      <div className="text-xs text-blue-400 mt-1 font-semibold">
                        {row.status} · {row.technical_answer_count || 0}/14 técnicas · {row.work_style_answer_count || 0}/30 personalidad
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigator.clipboard.writeText(link)} className="p-2 border border-[#263241] rounded-lg" title="Copiar enlace">
                        <Copy size={15} />
                      </button>
                      <button onClick={() => onOpenCandidateLink(row.session_id)} className="p-2 border border-[#263241] rounded-lg" title="Abrir">
                        <ExternalLink size={15} />
                      </button>
                      <button onClick={() => openDetail(row)} className="px-3 py-2 bg-blue-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Eye size={14} /> Ver
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showNew && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-[#101721] border border-[#263241] rounded-2xl p-6">
            {generatedLink ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold">Evaluación lista</h2>
                  <p className="text-xs text-slate-400 mt-1">Copia este enlace y envíalo al candidato.</p>
                </div>
                <textarea readOnly value={generatedLink} className="w-full h-32 bg-[#0a1017] border border-[#263241] rounded-xl p-3 text-xs font-mono" />
                <button onClick={() => navigator.clipboard.writeText(generatedLink)} className="w-full py-3 bg-blue-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <Copy size={16} /> Copiar enlace
                </button>
                <button onClick={closeNew} className="w-full py-2 text-sm text-slate-400">Cerrar</button>
              </div>
            ) : (
              <form onSubmit={createInvite} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">Nueva evaluación</h2>
                  <p className="text-xs text-slate-400">Nombre y correo. La evaluación es única para Ingeniero en Desarrollo de Software / Sistemas.</p>
                </div>
                <input required value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Nombre del candidato" className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-4 py-3 text-sm" />
                <input required type="text" inputMode="email" autoComplete="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="Correo del candidato" className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-4 py-3 text-sm" />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeNew} className="flex-1 py-3 border border-[#263241] rounded-xl text-sm">Cancelar</button>
                  <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 disabled:opacity-50 rounded-xl text-sm font-bold">
                    {loading ? 'Generando...' : 'Generar enlace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
