import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Bot, Save, Check, MessageSquare, ShieldOff, Mic2, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AgentConfigData {
  id: string; company_id: string; agent_name: string; company_description: string;
  tone: string; instructions: string; restrictions: string; fallback_message: string;
  attendance_modes: string[]; created_at: string; updated_at: string;
}

const TONE_OPTIONS = [
  { value: 'formal',     emoji: '🎩', label: 'Formal',     desc: 'Profissional e técnico' },
  { value: 'amigavel',   emoji: '😊', label: 'Amigável',   desc: 'Leve e próximo' },
  { value: 'direto',     emoji: '⚡', label: 'Direto',     desc: 'Curto e objetivo' },
  { value: 'consultivo', emoji: '🧠', label: 'Consultivo', desc: 'Orienta e pergunta' },
];

const ATTENDANCE_MODES = [
  { value: 'whatsapp', label: 'WhatsApp' }, { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'E-mail' },      { value: 'phone', label: 'Telefone' },
  { value: 'presencial', label: 'Presencial' },
];

const EMPTY = { agent_name: '', company_description: '', tone: 'amigavel', instructions: '', restrictions: '', fallback_message: '', attendance_modes: [] as string[] };

// Componente de seção reutilizável
function Section({ title, desc, icon: Icon, children }: { title: string; desc: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Input/Textarea estilizados
const inputCls = "w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400";
const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

export default function AgentConfig() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY });

  useEffect(() => { fetchAgent(); }, [company?.id]);

  const fetchAgent = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('agent_configs').select('*').eq('company_id', company.id).maybeSingle();
      if (error) throw error;
      if (data) {
        setExistingId(data.id);
        setFormData({ agent_name: data.agent_name || '', company_description: data.company_description || '', tone: data.tone || 'amigavel', instructions: data.instructions || '', restrictions: data.restrictions || '', fallback_message: data.fallback_message || '', attendance_modes: data.attendance_modes || [] });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const toggleMode = (v: string) => setFormData(p => ({ ...p, attendance_modes: p.attendance_modes.includes(v) ? p.attendance_modes.filter(m => m !== v) : [...p.attendance_modes, v] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!company?.id) return;
    if (!formData.agent_name.trim() || !formData.instructions.trim()) { alert('Preencha o nome do agente e as instruções.'); return; }
    setSaving(true);
    try {
      const payload = { agent_name: formData.agent_name.trim(), company_description: formData.company_description.trim(), tone: formData.tone, instructions: formData.instructions.trim(), restrictions: formData.restrictions.trim(), fallback_message: formData.fallback_message.trim(), attendance_modes: formData.attendance_modes, updated_at: new Date().toISOString() };
      if (existingId) {
        const { error } = await supabase.from('agent_configs').update(payload).eq('id', existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('agent_configs').insert([{ company_id: company.id, ...payload }]).select().single();
        if (error) throw error;
        setExistingId(data.id);
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { alert(err?.message || 'Erro ao salvar.'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6 w-full">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Agente de IA</h2>
          <p className="text-sm text-slate-500 mt-0.5">Configure a personalidade e comportamento do assistente virtual</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Identidade */}
          <Section title="Identidade" desc="Como o agente se apresenta" icon={Bot}>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nome do Agente <span className="text-red-400 normal-case">*</span></label>
                <input type="text" required value={formData.agent_name} onChange={e => setFormData({ ...formData, agent_name: e.target.value })}
                  placeholder="Ex: Sofia, Max, Assistente" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sobre a empresa</label>
                <textarea rows={3} value={formData.company_description} onChange={e => setFormData({ ...formData, company_description: e.target.value })}
                  placeholder="Ex: Somos uma loja de roupas, atendemos de seg a sab, 9h–18h..." className={inputCls + ' resize-none'} />
              </div>
            </div>
          </Section>

          {/* Tom de voz */}
          <Section title="Tom de Voz" desc="Como o agente se comunica" icon={Mic2}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setFormData({ ...formData, tone: opt.value })}
                  className={`p-3 rounded-lg border text-left transition-all ${formData.tone === opt.value ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                  <div className="text-lg mb-1">{opt.emoji}</div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* Instruções */}
          <Section title="Instruções" desc="O que o agente deve e não deve fazer" icon={MessageSquare}>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>O que deve fazer <span className="text-red-400 normal-case">*</span></label>
                <textarea required rows={4} value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="Ex: Recepcionar o cliente, responder dúvidas sobre produtos, encaminhar reclamações para o setor responsável..."
                  className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>O que NÃO deve fazer</label>
                <textarea rows={3} value={formData.restrictions} onChange={e => setFormData({ ...formData, restrictions: e.target.value })}
                  placeholder="Ex: Não prometer prazos, não discutir assuntos fora do escopo..."
                  className={inputCls + ' resize-none'} />
              </div>
            </div>
          </Section>

          {/* Fallback */}
          <Section title="Mensagem de Fallback" desc="Quando o agente não souber responder" icon={HelpCircle}>
            <input type="text" value={formData.fallback_message} onChange={e => setFormData({ ...formData, fallback_message: e.target.value })}
              placeholder="Ex: Não tenho essa informação, mas vou chamar um atendente para você!"
              className={inputCls} />
          </Section>

          {/* Canais */}
          <Section title="Canais de Atendimento" desc="Onde este agente vai atuar" icon={ShieldOff}>
            <div className="flex flex-wrap gap-2">
              {ATTENDANCE_MODES.map(mode => {
                const active = formData.attendance_modes.includes(mode.value);
                return (
                  <button key={mode.value} type="button" onClick={() => toggleMode(mode.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}>
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Botão salvar */}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</> : <><Save className="w-4 h-4" />{existingId ? 'Salvar alterações' : 'Criar agente'}</>}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-4 h-4" /> Salvo com sucesso!
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}