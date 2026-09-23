import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { encodeSimpleInvite, SimpleInvitePayload } from '../utils/inviteToken';
import { Copy, ExternalLink, Eye, Lock, LogOut, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  onOpenCandidateLink: (token: string) => void;
}

interface LocalInvite extends SimpleInvitePayload {
  token: string;
  link: string;
  createdAt: string;
}

interface InviteStatus {
  sessionStatus?: string;
  submittedAt?: string;
  workStyleCompleted?: boolean;
}

const ACCESS_CODE = 'RESET-2026';
const STORAGE_KEY = 'reset_simple_admin_invites_v1';
const ACCESS_KEY = 'reset_simple_admin_unlocked';

function loadInvites(): LocalInvite[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export const SimpleAdminDashboard: React.FC<Props> = ({ onOpenCandidateLink }) => {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ACCESS_KEY) === '1');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [invites, setInvites] = useState<LocalInvite[]>(loadInvites);
  const [statuses, setStatuses] = useState<Record<string, InviteStatus>>({});
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [variant, setVariant] = useState<'A' | 'B' | 'C'>('A');
  const [expiryDays, setExpiryDays] = useState(7);
  const [selected, setSelected] = useState<LocalInvite | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [workStyle, setWorkStyle] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const sortedInvites = useMemo(
    () => [...invites].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [invites]
  );

  const persistInvites = (next: LocalInvite[]) => {
    setInvites(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ACCESS_CODE) {
      sessionStorage.setItem(ACCESS_KEY, '1');
      setUnlocked(true);
      setCode('');
      setError('');
    } else {
      setError('Código incorrecto.');
    }
  };

  const logout = () => {
    sessionStorage.removeItem(ACCESS_KEY);
    setUnlocked(false);
    setSelected(null);
  };

  const refreshStatuses = async () => {
    setLoading(true);
    try {
      const next: Record<string, InviteStatus> = {};
      await Promise.all(invites.map(async (invite) => {
        const [sessionSnap, wsSnap] = await Promise.all([
          getDoc(doc(db, 'assessment_sessions', invite.sessionId)),
          getDoc(doc(db, 'work_style_assessments', `ws_${invite.sessionId}`))
        ]);
        next[invite.sessionId] = {
          sessionStatus: sessionSnap.exists() ? sessionSnap.data().status : undefined,
          submittedAt: sessionSnap.exists() ? sessionSnap.data().submittedAt : undefined,
          workStyleCompleted: wsSnap.exists() ? wsSnap.data().completed === true : false
        };
      }));
      setStatuses(next);
    } catch (err) {
      console.error('Unable to refresh assessment statuses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unlocked) void refreshStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, invites.length]);

  const createInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const now = Date.now();
    const sessionId = `sess_${now.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    const candidateId = `cand_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const payload: SimpleInvitePayload = {
      version: 1,
      candidateId,
      candidateName: name.trim(),
      candidateEmail: email.trim().toLowerCase(),
      variant,
      expiresAt: new Date(now + expiryDays * 86400000).toISOString(),
      sessionId
    };
    const token = encodeSimpleInvite(payload);
    const link = `${window.location.origin}${window.location.pathname}?token=${token}`;
    const record: LocalInvite = { ...payload, token, link, createdAt: new Date(now).toISOString() };

    persistInvites([...invites, record]);
    setGeneratedLink(link);
  };

  const resetNew = () => {
    setGeneratedLink('');
    setName('');
    setEmail('');
    setVariant('A');
    setExpiryDays(7);
    setShowNew(false);
  };

  const openDetail = async (invite: LocalInvite) => {
    setSelected(invite);
    setDetailLoading(true);
    setAnswers({});
    setWorkStyle(null);

    try {
      const answerEntries = await Promise.all(
        Array.from({ length: 14 }, async (_, index) => {
          const qid = `q${index + 1}`;
          const snap = await getDoc(doc(db, 'assessment_answers', `${invite.sessionId}_${qid}`));
          return [qid, snap.exists() ? snap.data() : null] as const;
        })
      );
      setAnswers(Object.fromEntries(answerEntries));

      const wsSnap = await getDoc(doc(db, 'work_style_assessments', `ws_${invite.sessionId}`));
      if (wsSnap.exists()) setWorkStyle(wsSnap.data());
    } catch (err) {
      console.error('Unable to load assessment detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
        <form onSubmit={login} className="w-full max-w-sm bg-[#101721] border border-[#263241] rounded-2xl p-8 space-y-5 shadow-2xl">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-950/70 border border-blue-800 flex items-center justify-center text-blue-400">
              <Lock size={22} />
            </div>
            <div className="text-xs font-bold tracking-widest text-blue-400">RESET</div>
            <h1 className="text-xl font-bold mt-1">Dashboard Administrativo</h1>
            <p className="text-xs text-slate-400 mt-2">Ingresa el código para continuar.</p>
          </div>
          {error && <div className="text-xs text-red-300 bg-red-950/30 border border-red-900 rounded-lg p-3">{error}</div>}
          <input
            type="password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de acceso"
            className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
          />
          <button className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl py-3 text-sm font-bold">
            Ingresar
          </button>
        </form>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <button onClick={() => setSelected(null)} className="text-sm text-blue-400 hover:underline">← Volver</button>
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6">
            <h1 className="text-2xl font-bold">{selected.candidateName}</h1>
            <p className="text-sm text-slate-400">{selected.candidateEmail} · Variante {selected.variant}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{selected.sessionId}</p>
          </div>

          {detailLoading ? (
            <div className="text-slate-400">Cargando respuestas desde Firebase...</div>
          ) : (
            <>
              <div className="bg-[#101721] border border-[#263241] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#263241] font-bold">Respuestas técnicas</div>
                <div className="divide-y divide-[#263241]">
                  {Array.from({ length: 14 }, (_, index) => {
                    const qid = `q${index + 1}`;
                    const answer = answers[qid]?.answer;
                    return (
                      <div key={qid} className="p-5">
                        <div className="text-xs font-bold text-blue-400 mb-2">Pregunta {index + 1}</div>
                        <div className="text-sm text-slate-200 whitespace-pre-wrap">{answer || 'Sin respuesta guardada'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-5">
                <div className="font-bold mb-3">Perfil de estilo de trabajo</div>
                {workStyle?.completed ? (
                  <div className="space-y-2">
                    <div className="text-sm text-emerald-400 font-semibold">Completado</div>
                    {workStyle.dimensionScores && (
                      <pre className="text-xs bg-[#0a1017] border border-[#263241] rounded-xl p-4 overflow-auto">
                        {JSON.stringify(workStyle.dimensionScores, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Aún no completado.</div>
                )}
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
            <div className="text-xs text-slate-400">Candidate Assessment</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshStatuses} className="p-2 border border-[#263241] rounded-lg" title="Actualizar">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => { setShowNew(true); setGeneratedLink(''); }} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-bold flex items-center gap-2">
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
          <div className="px-5 py-4 border-b border-[#263241] flex justify-between">
            <div>
              <h1 className="font-bold">Evaluaciones</h1>
              <p className="text-xs text-slate-500">Las respuestas se consultan directamente desde Firebase.</p>
            </div>
            <div className="text-xs text-slate-500">{invites.length} generadas</div>
          </div>

          {sortedInvites.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No hay evaluaciones generadas todavía.</div>
          ) : (
            <div className="divide-y divide-[#263241]">
              {sortedInvites.map((invite) => {
                const status = statuses[invite.sessionId];
                const expired = Date.now() > new Date(invite.expiresAt).getTime();
                const label = status?.workStyleCompleted ? 'Completada' :
                  status?.sessionStatus === 'submitted' ? 'Parte 1 entregada' :
                  status?.sessionStatus ? 'En curso' :
                  expired ? 'Expirada' : 'Pendiente';

                return (
                  <div key={invite.sessionId} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="font-bold">{invite.candidateName}</div>
                      <div className="text-xs text-slate-400">{invite.candidateEmail} · Variante {invite.variant}</div>
                      <div className="text-xs text-blue-400 mt-1 font-semibold">{label}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigator.clipboard.writeText(invite.link)} className="p-2 border border-[#263241] rounded-lg" title="Copiar enlace">
                        <Copy size={15} />
                      </button>
                      <button onClick={() => onOpenCandidateLink(invite.token)} className="p-2 border border-[#263241] rounded-lg" title="Abrir">
                        <ExternalLink size={15} />
                      </button>
                      <button onClick={() => openDetail(invite)} className="px-3 py-2 bg-blue-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Eye size={14} /> Ver
                      </button>
                      <button
                        onClick={() => persistInvites(invites.filter((x) => x.sessionId !== invite.sessionId))}
                        className="p-2 border border-[#263241] rounded-lg text-red-400"
                        title="Quitar del dashboard"
                      >
                        <Trash2 size={15} />
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
                <button onClick={resetNew} className="w-full py-2 text-sm text-slate-400">Cerrar</button>
              </div>
            ) : (
              <form onSubmit={createInvite} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">Nueva evaluación</h2>
                  <p className="text-xs text-slate-400">Solo necesitamos los datos mínimos para generar el enlace.</p>
                </div>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del candidato" className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-4 py-3 text-sm" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo del candidato" className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-4 py-3 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={variant} onChange={(e) => setVariant(e.target.value as 'A' | 'B' | 'C')} className="bg-[#0a1017] border border-[#263241] rounded-xl px-3 py-3 text-sm">
                    <option value="A">Variante A</option>
                    <option value="B">Variante B</option>
                    <option value="C">Variante C</option>
                  </select>
                  <select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))} className="bg-[#0a1017] border border-[#263241] rounded-xl px-3 py-3 text-sm">
                    <option value={1}>1 día</option>
                    <option value={3}>3 días</option>
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={resetNew} className="flex-1 py-3 border border-[#263241] rounded-xl text-sm">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-blue-600 rounded-xl text-sm font-bold">Generar enlace</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
