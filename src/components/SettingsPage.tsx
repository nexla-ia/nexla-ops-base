import { useState, useEffect, useRef } from 'react';
import { Palette, Building2, Upload, X, RotateCcw, Check, Save, MessageSquare } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const inputCls =
  'w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 ' +
  'text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'focus:border-transparent transition-all placeholder:text-slate-400';

const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';

const BUBBLE_COLORS = ['#3b82f6','#10b981','#8b5cf6','#ec4899','#f97316','#ef4444','#0ea5e9','#64748b'];
const TEXT_COLORS   = ['#ffffff','#f8fafc','#f1f5f9','#1e293b','#374151','#111827'];
const BG_COLORS     = ['#efeae2','#f8fafc','#f0f4f8','#e8f5e9','#fce4ec','#ede7f6','#ffffff','#1e293b'];

function Card({ title, desc, icon: Icon, children }: {
  title: string; desc: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ColorRow({ label, value, onChange, swatches }: {
  label: string; value: string; onChange: (v: string) => void; swatches: string[];
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {swatches.map(c => (
            <button key={c} type="button" onClick={() => onChange(c)} title={c}
              className={`w-5 h-5 rounded-md flex-shrink-0 transition-all border ${
                value.toLowerCase() === c.toLowerCase()
                  ? 'ring-2 ring-offset-1 ring-blue-500 scale-110 border-transparent'
                  : 'border-slate-200 dark:border-slate-600 hover:scale-110'
              }`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border border-slate-200 dark:border-slate-600 p-0.5 bg-transparent flex-shrink-0" />
          <input type="text" value={value}
            onChange={e => { const v = e.target.value.trim(); onChange(v.startsWith('#') ? v : '#' + v); }}
            className="w-20 px-2 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </div>
  );
}

function ChatPreview({ bgColor, sentBg, sentText, receivedBg, receivedText }: {
  bgColor: string; sentBg: string; sentText: string; receivedBg: string; receivedText: string;
}) {
  const msgs = [
    { sent: false, text: 'Olá! Como posso ajudar?', time: '10:30' },
    { sent: true,  text: 'Quero informações sobre o produto.', time: '10:31' },
    { sent: false, text: 'Claro! Me conta o que precisa 😊', time: '10:31' },
    { sent: true,  text: 'Obrigado pelo suporte!', time: '10:32' },
  ];
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">C</div>
        <div>
          <p className="text-xs font-semibold text-white leading-none">Cliente</p>
          <p className="text-[10px] text-slate-400 mt-0.5">● online</p>
        </div>
      </div>
      <div className="p-3 space-y-2" style={{ backgroundColor: bgColor, minHeight: 220 }}>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.sent ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[78%] px-3 py-1.5 rounded-xl shadow-sm"
              style={m.sent ? { backgroundColor: sentBg, color: sentText } : { backgroundColor: receivedBg, color: receivedText }}>
              <p className="text-xs leading-relaxed">{m.text}</p>
              <p className="text-[10px] opacity-50 mt-0.5 text-right">{m.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useTheme();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const isInit = useRef(false);

  const [form, setForm] = useState({
    companyName:                    settings.companyName                    || '',
    logoUrl:                        settings.logoUrl                        || '',
    backgroundColor:                settings.backgroundColor                || '#efeae2',
    messageBubbleSentColor:         settings.messageBubbleSentColor         || '#3b82f6',
    messageBubbleSentTextColor:     settings.messageBubbleSentTextColor     || '#ffffff',
    messageBubbleReceivedColor:     settings.messageBubbleReceivedColor     || '#ffffff',
    messageBubbleReceivedTextColor: settings.messageBubbleReceivedTextColor || '#1e293b',
  });

  useEffect(() => {
    if (!isInit.current && settings.companyName !== undefined) {
      setForm({
        companyName:                    settings.companyName                    || '',
        logoUrl:                        settings.logoUrl                        || '',
        backgroundColor:                settings.backgroundColor                || '#efeae2',
        messageBubbleSentColor:         settings.messageBubbleSentColor         || '#3b82f6',
        messageBubbleSentTextColor:     settings.messageBubbleSentTextColor     || '#ffffff',
        messageBubbleReceivedColor:     settings.messageBubbleReceivedColor     || '#ffffff',
        messageBubbleReceivedTextColor: settings.messageBubbleReceivedTextColor || '#1e293b',
      });
      isInit.current = true;
    }
  }, [settings]);

  const upd = (updates: Partial<typeof form>) => { setForm(p => ({ ...p, ...updates })); setHasChanges(true); };
  const flash = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(''), 3000); };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione uma imagem válida'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Máx 5 MB'); return; }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => { upd({ logoUrl: reader.result as string }); setUploadingLogo(false); };
    reader.onerror = () => setUploadingLogo(false);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await updateSettings(form); setHasChanges(false); flash('Configurações salvas!'); }
    catch { alert('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm('Restaurar todas as configurações para o padrão?')) return;
    await resetSettings();
    const d = { companyName: '', logoUrl: '', backgroundColor: '#efeae2', messageBubbleSentColor: '#3b82f6', messageBubbleSentTextColor: '#ffffff', messageBubbleReceivedColor: '#ffffff', messageBubbleReceivedTextColor: '#1e293b' };
    setForm(d); setHasChanges(false); flash('Configurações restauradas!');
  };

  return (
    <div className="p-6 w-full">

      {/* Toast */}
      {savedMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-lg"
          style={{ animation: 'fsDown .2s ease-out' }}>
          <style>{`@keyframes fsDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <Check className="w-4 h-4" /> {savedMsg}
        </div>
      )}

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Configurações</h2>
            <p className="text-sm text-slate-500 mt-0.5">Personalize a identidade e aparência do sistema</p>
          </div>
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse inline-block" />
              Alterações não salvas
            </span>
          )}
        </div>

        {/* Grid: controles + preview sticky */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

          {/* Esquerda */}
          <div className="space-y-4">

            {/* Identidade */}
            <Card title="Identidade da Empresa" desc="Nome e logo exibidos no sistema" icon={Building2}>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Nome da empresa</label>
                  <input type="text" value={form.companyName} onChange={e => upd({ companyName: e.target.value })}
                    placeholder="Nome da sua empresa" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    Logo&nbsp;<span className="font-normal text-slate-400">(200×60 px · máx 5 MB)</span>
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {form.logoUrl ? (
                      <div className="relative inline-flex">
                        <img src={form.logoUrl} alt="Logo"
                          className="h-10 max-w-[160px] object-contain border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white dark:bg-slate-800" />
                        <button onClick={() => upd({ logoUrl: '' })}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-10 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-300">
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingLogo ? 'Processando…' : form.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </Card>

            {/* Cores */}
            <Card title="Aparência das Mensagens" desc="Cores dos balões de conversa" icon={Palette}>
              <div className="space-y-5">

                {/* Fundo */}
                <ColorRow label="Fundo do chat" value={form.backgroundColor} onChange={v => upd({ backgroundColor: v })} swatches={BG_COLORS} />

                <div className="h-px bg-slate-100 dark:bg-slate-700/60" />

                {/* Recebidas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensagens recebidas</p>
                    <button onClick={() => upd({ messageBubbleReceivedColor: '#ffffff', messageBubbleReceivedTextColor: '#1e293b' })}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Resetar
                    </button>
                  </div>
                  <div className="space-y-3">
                    <ColorRow label="Cor do balão" value={form.messageBubbleReceivedColor}     onChange={v => upd({ messageBubbleReceivedColor: v })}     swatches={BUBBLE_COLORS} />
                    <ColorRow label="Cor do texto" value={form.messageBubbleReceivedTextColor} onChange={v => upd({ messageBubbleReceivedTextColor: v })} swatches={TEXT_COLORS}   />
                  </div>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-700/60" />

                {/* Enviadas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Mensagens enviadas</p>
                    <button onClick={() => upd({ messageBubbleSentColor: '#3b82f6', messageBubbleSentTextColor: '#ffffff' })}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Resetar
                    </button>
                  </div>
                  <div className="space-y-3">
                    <ColorRow label="Cor do balão" value={form.messageBubbleSentColor}     onChange={v => upd({ messageBubbleSentColor: v })}     swatches={BUBBLE_COLORS} />
                    <ColorRow label="Cor do texto" value={form.messageBubbleSentTextColor} onChange={v => upd({ messageBubbleSentTextColor: v })} swatches={TEXT_COLORS}   />
                  </div>
                </div>

              </div>
            </Card>

          </div>{/* fim esquerda */}

          {/* Direita — preview sticky */}
          <div className="xl:sticky xl:top-6">
            <Card title="Preview" desc="Visualização em tempo real" icon={MessageSquare}>
              <ChatPreview
                bgColor={form.backgroundColor}
                sentBg={form.messageBubbleSentColor}
                sentText={form.messageBubbleSentTextColor}
                receivedBg={form.messageBubbleReceivedColor}
                receivedText={form.messageBubbleReceivedTextColor}
              />
            </Card>
          </div>

        </div>{/* fim grid */}

        {/* Ações */}
        <div className="flex items-center justify-between gap-4 mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
          <button onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/40 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 text-sm font-medium rounded-lg transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrões
          </button>
          <button onClick={handleSave} disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
              hasChanges && !saving ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}>
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

      </div>
    </div>
  );
}