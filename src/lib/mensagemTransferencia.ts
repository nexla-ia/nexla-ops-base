import { supabase } from './supabase';

export interface TransferenciaData {
    api_key: string;
    contact_id: string;  // ✅ UUID do contato
    departamento_origem_id: string | null;  // ✅ UUID ou NULL (recepção)
    departamento_destino_id: string | null;  // ✅ UUID ou NULL (recepção)
}

export interface TransferenciaResponse {
    sucesso: boolean;
    erro?: string;
    data?: any;
}

export async function registrarTransferencia(data: TransferenciaData): Promise<TransferenciaResponse> {
    try {
        console.log('📝 [1] Validando dados da transferência:', data);
        
        // Validações
        if (!data.api_key?.trim()) {
            const erro = 'API key vazia';
            console.error('❌ [1]', erro);
            return { sucesso: false, erro };
        }
        if (!data.contact_id?.trim()) {
            const erro = 'ID do contato vazio';
            console.error('❌ [1]', erro);
            return { sucesso: false, erro };
        }
        // ✅ Agora departamento_destino_id PODE ser NULL (Recepção é permitida)

        console.log('✅ [1] Dados válidos para registrar transferência');
        console.log('📝 [2] Preparando chamada para RPC registrar_transferencia_automatica...');
        
        // Exibir o que será enviado com clareza
        const originName = data.departamento_origem_id || 'Recepção (NULL)';
        const destName = data.departamento_destino_id || 'Recepção (NULL)';
        console.log(`  📍 Origem: ${originName}`);
        console.log(`  📍 Destino: ${destName}`);
        
        // ✅ Chamar RPC que registra transferência
        const { data: resultado, error } = await supabase.rpc(
            'registrar_transferencia_por_contact_id',
            {
                p_api_key: data.api_key,
                p_contact_id: data.contact_id,
                p_from_department_id: data.departamento_origem_id ?? null,
                p_to_department_id: data.departamento_destino_id ?? null
            }
        );

        console.log('📨 [3] Resposta da RPC:', { 
            resultado: resultado ? 'sucesso' : 'sem dados',
            erro: error?.message 
        });

        if (error) {
            console.error('❌ [3] Erro ao chamar RPC:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return { sucesso: false, erro: error.message };
        }

        if (!resultado) {
            console.error('❌ [3.5] RPC retornou undefined/null');
            return { sucesso: false, erro: 'RPC retornou vazio' };
        }

        const dados = Array.isArray(resultado) ? resultado[0] : resultado;
        
        if (!dados) {
            console.error('❌ [3.8] Nenhum dado retornado após processamento');
            return { sucesso: false, erro: 'RPC retornou array vazio' };
        }

        console.log('✅ [4] Transferência registrada com sucesso:', dados);
        return { sucesso: true, data: dados };

    } catch (erro) {
        console.error('❌ [5] Erro exceção ao registrar transferência:', erro);
        return { sucesso: false, erro: String(erro) };
    }
}

export async function listarTransferencias(api_key: string) {
    try {
        const { data: resultado, error } = await supabase.rpc(
            'listar_transferencias',
            { p_api_key: api_key }
        );

        if (error) {
            console.error('❌ Erro ao listar transferências:', error);
            return { sucesso: false, erro: error.message, data: [] };
        }

        return { sucesso: true, data: Array.isArray(resultado) ? resultado : resultado ? [resultado] : [] };
    } catch (erro) {
        console.error('❌ Erro na função listarTransferencias:', erro);
        return { sucesso: false, erro: String(erro), data: [] };
    }
}

export async function listarTransferenciasContato(api_key: string, phone_number: string) {
    try {
        const { data: resultado, error } = await supabase.rpc(
            'listar_transferencias_contato',
            { p_api_key: api_key, p_phone_number: phone_number }
        );

        if (error) {
            console.error('❌ Erro ao listar transferências do contato:', error);
            return { sucesso: false, erro: error.message, data: [] };
        }

        return { sucesso: true, data: Array.isArray(resultado) ? resultado : resultado ? [resultado] : [] };
    } catch (erro) {
        console.error('❌ Erro na função listarTransferenciasContato:', erro);
        return { sucesso: false, erro: String(erro), data: [] };
    }
}

export function formatarMensagemTransferencia(
    phone_number: string,
    nome_contato: string,
    departamento_origem: string,
    departamento_destino: string
): string {
    const agora = new Date().toLocaleString('pt-BR');
    return `📞 TRANSFERÊNCIA DE CONTATO\n\nTelefone: ${phone_number}\nNome: ${nome_contato}\nDe: ${departamento_origem}\nPara: ${departamento_destino}\nHorário: ${agora}`;
}
