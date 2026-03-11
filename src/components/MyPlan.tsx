import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard, Users, MessageSquare, Bot, Check, Loader2, ChevronDown, ChevronUp, Zap, Copy, Calendar, AlertCircle } from 'lucide-react';

interface Plan { id: string; name: string; description: string | null; price: number; billing_period: 'monthly' | 'annual'; max_attendants: number | null; max_contacts: number | null; is_active: boolean; ai_enabled: boolean; created_at: string; }
interface Company { payment_day: number | null; payment_notification_day: number | null; plan_id: string | null; }
interface MyPlanProps { companyId: string; }

export default function MyPlan({ companyId }: MyPlanProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [pixKey, setPixKey] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadData(); }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true); setError(null);
      const { data: co, error: ce } = await supabase.from('companies').select('plan_id,payment_day,payment_notification_day').eq('id', companyId).maybeSingle();
      if (ce) throw ce;
      if (!co?.plan_id) { setError('Nenhum plano associado a esta empresa.'); return; }
      setCompany(co);
      const { data: pl, error: pe } = await supabase.from('plans').select('*').eq('id', co.plan_id).maybeSingle();
      if (pe) throw pe;
      if (!pl) { setError('Plano não encontrado.'); return; }
      setPlan(pl);
      const { data: all } = await supabase.from('plans').select('*').eq('is_active', true).order('price', { ascending: true });
      setAllPlans(all || []);
      const { data: sys } = await supabase.from('system_settings').select('pix_key').maybeSingle();
      if (sys) setPixKey(sys.pix_key || '');
    } catch (err) { setError('Erro ao carregar informações do plano.'); } finally { setLoading(false); }
  };

  const handleUpgrade = () => { const msg = encodeURIComponent(`Olá! Gostaria de conhecer outras opções de plano. Atualmente estou no plano "${plan?.name}".`); window.open(`https://wa.me/5511999999999?text=${msg}`, '_blank'); };

  const getNextPayment = () => {
    if (!company?.payment_notification_day) return null;
    const today = new Date(), d = company.payment_notification_day;
    let next = new Date(today.getFullYear(), today.getMonth(), d);
    if (next < today) next = new Date(today.getFullYear(), today.getMonth() + 1, d);
    return next.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  if (error || !plan) return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{error || 'Plano não encontrado'}</p>
    </div>
  );

  const nextPayment = getNextPayment();
  const features = [
    { icon: Users, label: 'Atendentes', value: plan.max_attendants ? `Até ${plan.max_attendants}` : 'Ilimitados', ok: true },
    { icon: MessageSquare, label: 'Contatos', value: plan.max_contacts ? `Até ${plan.max_contacts}` : 'Ilimitados', ok: true },
    { icon: Bot, label: 'Inteligência Artificial', value: plan.ai_enabled ? 'Disponível' : 'Não disponível', ok: plan.ai_enabled },
  ];

  return (
    <div className="p-6 w-full">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Meu Plano</h2>
          <p className="text-sm text-slate-500 mt-0.5">Informações e recursos do seu plano atual</p>
        </div>

        {/* Card plano atual */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
          {/* Topo colorido */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-full mb-3">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Plano ativo
                </span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                {plan.description && <p className="text-sm text-slate-500 mt-1 max-w-md">{plan.description}</p>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900 dark:text-white">R$ {plan.price.toFixed(2)}</div>
                <div className="text-xs text-slate-500 flex items-center justify-end gap-1 mt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {plan.billing_period === 'monthly' ? 'por mês' : 'por ano'}
                </div>
                {nextPayment && <div className="text-xs text-slate-400 mt-1">Vence em {nextPayment}</div>}
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${f.ok ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 opacity-60'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.ok ? 'bg-blue-100 dark:bg-blue-500/15' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <Icon className={`w-4 h-4 ${f.ok ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{f.label}</p>
                      <p className={`text-sm font-semibold ${f.ok ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{f.value}</p>
                    </div>
                    {f.ok && <Check className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* PIX */}
            {pixKey && (
              <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Chave PIX para pagamento</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 truncate">{pixKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(pixKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                  </button>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3 mt-5">
              <button onClick={handleUpgrade}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Zap className="w-4 h-4" /> Fazer upgrade
              </button>
              <button onClick={() => setShowAllPlans(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors">
                {showAllPlans ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showAllPlans ? 'Ocultar planos' : 'Comparar planos'}
              </button>
            </div>
          </div>
        </div>

        {/* Todos os planos */}
        {showAllPlans && allPlans.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Todos os planos disponíveis</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-900">
              {allPlans.map(p => {
                const isCurrent = p.id === plan.id;
                return (
                  <div key={p.id} className={`p-5 flex flex-col ${isCurrent ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{p.name}</p>
                        {isCurrent && <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5"><Check className="w-3 h-3" /> Seu plano</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">R$ {p.price.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">{p.billing_period === 'monthly' ? '/mês' : '/ano'}</p>
                      </div>
                    </div>
                    {p.description && <p className="text-xs text-slate-500 mb-3 flex-1">{p.description}</p>}
                    <div className="space-y-1.5 mb-4">
                      {[
                        { icon: Users, label: p.max_attendants ? `Até ${p.max_attendants} atendentes` : 'Atendentes ilimitados', ok: true },
                        { icon: MessageSquare, label: p.max_contacts ? `Até ${p.max_contacts} contatos` : 'Contatos ilimitados', ok: true },
                        { icon: Bot, label: p.ai_enabled ? 'IA disponível' : 'Sem IA', ok: p.ai_enabled },
                      ].map((f, i) => { const Icon = f.icon; return (
                        <div key={i} className={`flex items-center gap-2 text-xs ${f.ok ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />{f.label}
                        </div>
                      ); })}
                    </div>
                    {!isCurrent && (
                      <button onClick={handleUpgrade}
                        className="w-full py-2 bg-slate-900 dark:bg-slate-700 hover:bg-blue-600 dark:hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors">
                        Escolher plano
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}