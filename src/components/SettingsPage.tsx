import { useState, useEffect, useRef } from 'react';
import { Palette, Building2, Upload, X, RotateCcw, Check, Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useTheme();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const isInitialized = useRef(false);

  const [formData, setFormData] = useState({
    companyName: settings.companyName || '',
    logoUrl: settings.logoUrl || '',
    backgroundColor: settings.backgroundColor || '#f8fafc',
    messageBubbleSentColor: settings.messageBubbleSentColor || '#3b82f6',
    messageBubbleSentTextColor: settings.messageBubbleSentTextColor || '#ffffff',
    messageBubbleReceivedColor: settings.messageBubbleReceivedColor || '#ffffff',
    messageBubbleReceivedTextColor: settings.messageBubbleReceivedTextColor || '#1e293b',
  });

  useEffect(() => {
    if (!isInitialized.current && settings.companyName) {
      setFormData({
        companyName: settings.companyName || '',
        logoUrl: settings.logoUrl || '',
        backgroundColor: settings.backgroundColor || '#f8fafc',
        messageBubbleSentColor: settings.messageBubbleSentColor || '#3b82f6',
        messageBubbleSentTextColor: settings.messageBubbleSentTextColor || '#ffffff',
        messageBubbleReceivedColor: settings.messageBubbleReceivedColor || '#ffffff',
        messageBubbleReceivedTextColor: settings.messageBubbleReceivedTextColor || '#1e293b',
      });
      isInitialized.current = true;
    }
  }, [settings]);

  const showSavedMessage = (message: string) => {
    setSavedMessage(message);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const isValidHexColor = (color: string): boolean => {
    return /^#[0-9A-F]{6}$/i.test(color);
  };

  const normalizeHexColor = (color: string): string => {
    color = color.trim();
    if (!color.startsWith('#')) {
      color = '#' + color;
    }
    color = color.toUpperCase();
    if (isValidHexColor(color)) {
      return color;
    }
    return color;
  };

  const handleColorTextChange = (field: keyof typeof formData, value: string) => {
    const normalized = normalizeHexColor(value);
    updateFormData({ [field]: normalized } as any);
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 5MB');
      return;
    }

    setUploadingLogo(true);

    try {
      const base64Image = await convertToBase64(file);
      updateFormData({ logoUrl: base64Image });
    } catch (error) {
      console.error('Erro ao processar o logo:', error);
      alert('Erro ao processar o logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    updateFormData({ logoUrl: '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(formData);
      setHasChanges(false);
      showSavedMessage('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSentBubble = () => {
    updateFormData({
      messageBubbleSentColor: '#3b82f6',
      messageBubbleSentTextColor: '#ffffff',
    });
  };

  const handleResetReceivedBubble = () => {
    updateFormData({
      messageBubbleReceivedColor: '#ffffff',
      messageBubbleReceivedTextColor: '#1e293b',
    });
  };

  const handleResetAll = async () => {
    if (confirm('Tem certeza que deseja restaurar TODAS as configurações para o padrão? Esta ação não pode ser desfeita.')) {
      try {
        await resetSettings();
        setFormData({
          companyName: '',
          logoUrl: '',
          backgroundColor: '#f8fafc',
          messageBubbleSentColor: '#3b82f6',
          messageBubbleSentTextColor: '#ffffff',
          messageBubbleReceivedColor: '#ffffff',
          messageBubbleReceivedTextColor: '#1e293b',
        });
        setHasChanges(false);
        showSavedMessage('Todas as configurações foram resetadas!');
      } catch (error) {
        console.error('Erro ao resetar configurações:', error);
        alert('Erro ao resetar configurações');
      }
    }
  };

  const messageColorPresets = [
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Verde', value: '#10b981' },
    { name: 'Roxo', value: '#8b5cf6' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Laranja', value: '#f97316' },
    { name: 'Cinza', value: '#64748b' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {savedMessage && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slideUp">
            <Check className="w-5 h-5" />
            {savedMessage}
          </div>
        )}

        {hasChanges && (
          <div className="fixed bottom-6 right-6 z-50 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Você tem alterações não salvas
          </div>
        )}

        <div className="animate-fadeIn mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Configurações da Empresa</h1>
          <p className="text-slate-600">Personalize a aparência do seu sistema. Clique em "Salvar Alterações" para aplicar as mudanças.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 animate-slideUp">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Identidade da Empresa</h2>
                  <p className="text-sm text-slate-600">Logo e nome exibidos no sistema</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateFormData({ companyName: e.target.value })}
                  placeholder="Digite o nome da empresa"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Logo da Empresa <span className="text-slate-500">(Recomendado: 200x60px)</span>
                </label>

                {formData.logoUrl && (
                  <div className="mb-4 relative inline-block">
                    <img
                      src={formData.logoUrl}
                      alt="Logo"
                      className="h-16 object-contain border border-slate-200 rounded-lg p-2 bg-white"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-all">
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? 'Enviando...' : 'Enviar Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 animate-slideUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                <Palette className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Balões de Mensagem</h2>
                <p className="text-sm text-slate-600">Personalize as cores das mensagens</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Mensagens Recebidas</h3>
                    <button
                      onClick={handleResetReceivedBubble}
                      className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Resetar
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Cor do Balão
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                        {messageColorPresets.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => updateFormData({ messageBubbleReceivedColor: preset.value })}
                            className="relative group"
                          >
                            <div
                              className={`w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                                formData.messageBubbleReceivedColor === preset.value
                                  ? 'border-blue-500 scale-95'
                                  : 'border-slate-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.value }}
                            />
                            <p className="text-xs font-medium text-slate-700 mt-1 text-center">
                              {preset.name}
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.messageBubbleReceivedColor}
                          onChange={(e) => updateFormData({ messageBubbleReceivedColor: e.target.value })}
                          className="w-16 h-10 rounded-lg cursor-pointer border-2 border-slate-300"
                        />
                        <input
                          type="text"
                          value={formData.messageBubbleReceivedColor}
                          onChange={(e) => handleColorTextChange('messageBubbleReceivedColor', e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Cor do Texto
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.messageBubbleReceivedTextColor}
                          onChange={(e) => updateFormData({ messageBubbleReceivedTextColor: e.target.value })}
                          className="w-16 h-10 rounded-lg cursor-pointer border-2 border-slate-300"
                        />
                        <input
                          type="text"
                          value={formData.messageBubbleReceivedTextColor}
                          onChange={(e) => handleColorTextChange('messageBubbleReceivedTextColor', e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="#1e293b"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Mensagens Enviadas</h3>
                    <button
                      onClick={handleResetSentBubble}
                      className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Resetar
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Cor do Balão
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                        {messageColorPresets.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => updateFormData({ messageBubbleSentColor: preset.value })}
                            className="relative group"
                          >
                            <div
                              className={`w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                                formData.messageBubbleSentColor === preset.value
                                  ? 'border-blue-500 scale-95'
                                  : 'border-slate-300 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.value }}
                            />
                            <p className="text-xs font-medium text-slate-700 mt-1 text-center">
                              {preset.name}
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.messageBubbleSentColor}
                          onChange={(e) => updateFormData({ messageBubbleSentColor: e.target.value })}
                          className="w-16 h-10 rounded-lg cursor-pointer border-2 border-slate-300"
                        />
                        <input
                          type="text"
                          value={formData.messageBubbleSentColor}
                          onChange={(e) => handleColorTextChange('messageBubbleSentColor', e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Cor do Texto
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.messageBubbleSentTextColor}
                          onChange={(e) => updateFormData({ messageBubbleSentTextColor: e.target.value })}
                          className="w-16 h-10 rounded-lg cursor-pointer border-2 border-slate-300"
                        />
                        <input
                          type="text"
                          value={formData.messageBubbleSentTextColor}
                          onChange={(e) => handleColorTextChange('messageBubbleSentTextColor', e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="sticky top-6">
                  <div className="flex items-center justify-center mb-4">
                    <h3 className="text-2xl font-bold text-slate-900 text-center">Visualização</h3>
                  </div>
                  <div className="space-y-5 p-8 rounded-2xl border-4 border-blue-200 shadow-2xl min-h-[600px] flex flex-col justify-center" style={{ backgroundColor: formData.backgroundColor }}>
                    <div className="flex justify-start">
                      <div
                        className="max-w-[75%] px-6 py-4 rounded-2xl rounded-tl-sm shadow-lg"
                        style={{
                          backgroundColor: formData.messageBubbleReceivedColor,
                          color: formData.messageBubbleReceivedTextColor
                        }}
                      >
                        <p className="text-base font-medium leading-relaxed">
                          Exemplo de mensagem recebida
                        </p>
                        <p className="text-xs opacity-70 mt-2">10:30</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div
                        className="max-w-[75%] px-6 py-4 rounded-2xl rounded-tr-sm shadow-lg"
                        style={{
                          backgroundColor: formData.messageBubbleSentColor,
                          color: formData.messageBubbleSentTextColor
                        }}
                      >
                        <p className="text-base font-medium leading-relaxed">
                          Exemplo de mensagem enviada
                        </p>
                        <p className="text-xs opacity-70 mt-2">10:32</p>
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <div
                        className="max-w-[75%] px-6 py-4 rounded-2xl rounded-tl-sm shadow-lg"
                        style={{
                          backgroundColor: formData.messageBubbleReceivedColor,
                          color: formData.messageBubbleReceivedTextColor
                        }}
                      >
                        <p className="text-base font-medium leading-relaxed">
                          Olá! Como posso ajudar?
                        </p>
                        <p className="text-xs opacity-70 mt-2">10:33</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div
                        className="max-w-[75%] px-6 py-4 rounded-2xl rounded-tr-sm shadow-lg"
                        style={{
                          backgroundColor: formData.messageBubbleSentColor,
                          color: formData.messageBubbleSentTextColor
                        }}
                      >
                        <p className="text-base font-medium leading-relaxed">
                          Gostaria de mais informações sobre o produto
                        </p>
                        <p className="text-xs opacity-70 mt-2">10:35</p>
                      </div>
                    </div>

                    <div className="text-center mt-6 pt-6 border-t-2 border-slate-300">
                      <p className="text-sm font-semibold text-slate-600">Preview em Tempo Real</p>
                      <p className="text-xs text-slate-500 mt-1">As alterações aparecem instantaneamente</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 sticky bottom-0 bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
            <button
              onClick={handleResetAll}
              className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Tudo ao Padrão
            </button>

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`px-8 py-3 font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2 ${
                hasChanges && !saving
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
