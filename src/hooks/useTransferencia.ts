import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { registrarTransferencia, listarTransferencias, listarTransferenciasContato, TransferenciaData } from '../lib/mensagemTransferencia';

export interface Transferencia {
    id: number;
    api_key: string;
    contact_id: string;
    phone_number: string;
    departamento_origem_id: string;
    departamento_origem_nome: string;
    departamento_destino_id: string;
    departamento_destino_nome: string;
    data_transferencia: string;
}

export function useTransferencia(apiKey: string) {
    const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    // Carregar transferências iniciais
    useEffect(() => {
        carregarTransferencias();
    }, [apiKey]);

    async function carregarTransferencias() {
        try {
            setCarregando(true);
            const resultado = await listarTransferencias(apiKey);
            
            if (resultado.sucesso) {
                setTransferencias(resultado.data || []);
                setErro(null);
            } else {
                setErro(resultado.erro || null);
            }
        } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro ao carregar transferências');
        } finally {
            setCarregando(false);
        }
    }

    // Inscrever-se a atualizações em tempo real
    useEffect(() => {
        const channel = supabase
            .channel(`transferencias:${apiKey}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transferencias',
                    filter: `api_key=eq.${apiKey}`
                },
                (payload) => {
                    console.log('📢 Realtime update:', payload);
                    if (payload.eventType === 'INSERT') {
                        setTransferencias((prev) => [payload.new as Transferencia, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        setTransferencias((prev) =>
                            prev.filter((t) => t.id !== (payload.old as Transferencia).id)
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [apiKey]);

    async function adicionarTransferencia(data: TransferenciaData) {
        try {
            const resultado = await registrarTransferencia(data);
            if (resultado.sucesso) {
                // Adicionar à lista localmente também
                if (resultado.data && resultado.data.length > 0) {
                    setTransferencias((prev) => [...resultado.data, ...prev]);
                }
                return resultado;
            }
            setErro(resultado.erro || null);
            return resultado;
        } catch (e) {
            const mensagem = e instanceof Error ? e.message : 'Erro ao adicionar transferência';
            setErro(mensagem);
            return { sucesso: false, erro: mensagem };
        }
    }

    return {
        transferencias,
        carregando,
        erro,
        adicionarTransferencia,
        recarregar: carregarTransferencias
    };
}

export function useTransferenciaContato(apiKey: string, numeroContato: number) {
    const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    // Carregar transferências do contato
    useEffect(() => {
        carregarTransferenciasContato();
    }, [apiKey, numeroContato]);
    async function carregarTransferenciasContato() {
        try {
            setCarregando(true);
            const resultado = await listarTransferenciasContato(apiKey, numeroContato);
            
            if (resultado.sucesso) {
                setTransferencias(resultado.data || []);
                setErro(null);
            } else {
                setErro(resultado.erro || null);
            }
        } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro ao carregar transferências');
        } finally {
            setCarregando(false);
        }
    }

    return {
        transferencias,
        carregando,
        erro,
        recarregar: carregarTransferenciasContato
    };
}
