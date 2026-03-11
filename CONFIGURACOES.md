# 🎨 Configurações de Aparência

## Visão Geral

A tela de **Configurações** permite personalizar completamente a aparência visual do sistema sem alterar os dados no banco. Todas as configurações são salvas localmente no navegador usando `localStorage`.

## Como Acessar

1. Faça login como **Empresa** (Company)
2. Clique na aba **Configurações** no menu superior
3. Personalize as opções desejadas
4. Clique em **Salvar Configurações**

## Recursos Disponíveis

### 1. 🖼️ Logo do Sistema

**Substitua o ícone padrão pelo logo da sua empresa**

- **Formatos aceitos:** PNG, JPG, SVG
- **Tamanho máximo:** 2MB
- **Como usar:**
  - Clique no botão "Clique para fazer upload"
  - Selecione uma imagem do seu computador
  - O logo aparecerá no canto superior esquerdo do sistema
  - Para trocar: clique em "Trocar Logo"
  - Para remover: clique em "Remover"

### 2. ✏️ Nome de Exibição

**Personalize o nome que aparece no topo do sistema**

- Digite o nome da sua empresa ou marca
- Este nome substitui o padrão "ChatFlow"
- Aparece ao lado do logo no cabeçalho
- **Importante:** Esta alteração é apenas visual e não afeta o banco de dados

### 3. 🎨 Cores das Mensagens

**Personalize as cores das mensagens recebidas e enviadas**

#### Mensagens Recebidas
- **Cor de Fundo:** Personalize a cor do balão da mensagem
- **Cor do Texto:** Personalize a cor do texto dentro do balão
- **Presets disponíveis:**
  - Cinza Claro (padrão)
  - Verde Claro
  - Azul Claro
  - Rosa Claro
  - Amarelo Claro

#### Mensagens Enviadas
- **Cor de Fundo:** Personalize a cor do balão da mensagem
- **Cor do Texto:** Personalize a cor do texto dentro do balão
- **Presets disponíveis:**
  - Azul (padrão)
  - Verde
  - Roxo
  - Rosa
  - Laranja

#### Formas de Alterar Cores

1. **Seletor de Cores:** Clique no quadrado colorido para abrir o seletor visual
2. **Código Hexadecimal:** Digite ou cole o código da cor (ex: #3b82f6)
3. **Presets:** Clique em um dos quadrados coloridos abaixo para aplicar rapidamente

#### Pré-visualização

Uma prévia em tempo real mostra como as mensagens ficarão com as cores escolhidas.

## Salvando e Restaurando

### Salvar Configurações
- Clique no botão **Salvar Configurações** (azul)
- Uma notificação confirmará que as configurações foram salvas
- As alterações serão aplicadas imediatamente

### Restaurar Padrão
- Clique no botão **Restaurar Padrão** (cinza)
- Todas as configurações voltarão aos valores originais
- Logo, nome e cores serão resetados

## Armazenamento

- **Onde é salvo:** `localStorage` do navegador
- **Persistência:** As configurações permanecem mesmo após fechar o navegador
- **Sincronização:** Cada navegador/dispositivo tem suas próprias configurações
- **Não afeta:** Banco de dados, outros usuários ou dispositivos

## Aplicação das Configurações

### Logo
- Aparece no cabeçalho do dashboard
- Substitui o ícone padrão de chat
- Dimensões: 40x40 pixels (ajustado automaticamente)

### Nome de Exibição
- Aparece ao lado do logo
- Substitui "ChatFlow" em todos os lugares visíveis

### Cores das Mensagens
- Aplicadas automaticamente em:
  - Dashboard de Empresa (Company)
  - Dashboard de Atendente (Attendant)
  - Todas as conversas e chats
  - Pré-visualizações de mensagens

## Dicas

✅ **Contraste:** Certifique-se de que a cor do texto tenha bom contraste com o fundo
✅ **Identidade:** Use as cores da sua marca para criar identidade visual
✅ **Testes:** Teste diferentes combinações antes de decidir
✅ **Logo:** Use imagens com fundo transparente (PNG) para melhor resultado
✅ **Backup:** Anote os códigos hexadecimais das suas cores caso precise recriar

## Compatibilidade

- ✅ Funciona em todos os navegadores modernos
- ✅ Responsivo (adapta-se a diferentes tamanhos de tela)
- ✅ Não requer conexão com internet após carregado
- ✅ Compatível com modo claro (tema escuro não disponível)

## Suporte

Se tiver dúvidas ou problemas:
1. Tente restaurar as configurações padrão
2. Limpe o cache do navegador
3. Verifique se o navegador permite `localStorage`
4. Entre em contato com o suporte técnico
