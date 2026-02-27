import { useMemo, useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { UploadLog, UploadStatus } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Clock, XCircle, FileText, RefreshCw, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';

type DiagnosticResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const statusConfig: Record<UploadStatus, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' },
  processing: { label: 'Processando', icon: RefreshCw, variant: 'default' },
  sucesso: { label: 'Sucesso', icon: CheckCircle2, variant: 'outline' },
  erro: { label: 'Erro', icon: XCircle, variant: 'destructive' },
};

const normalizeLog = (log: any): UploadLog => ({
  id: log.id,
  user_id: log.user_id,
  materia_id: log.materia_id,
  arquivo_nome: log.arquivo_nome ?? log.nome_arquivo ?? 'Arquivo sem nome',
  arquivo_tipo: log.arquivo_tipo ?? log.tipo ?? 'desconhecido',
  status: (log.status ?? 'erro') as UploadStatus,
  mensagem: log.mensagem ?? null,
  erro_detalhes: log.erro_detalhes ?? log.mensagem_erro ?? null,
  aula_criada_id: log.aula_criada_id ?? null,
  created_at: log.created_at,
});

export default function AdminLogs() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdminUser = isAdmin();

  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<UploadStatus | 'all'>('all');

  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdminUser) {
      navigate(ROUTE_PATHS.DASHBOARD);
    }
  }, [authLoading, isAdminUser, navigate]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('upload_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) throw fetchError;

      const normalized = (data || []).map(normalizeLog);
      setLogs(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdminUser) {
      fetchLogs();
    }
  }, [authLoading, isAdminUser, fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (statusFilter === 'all') return logs;
    return logs.filter((log) => log.status === statusFilter);
  }, [logs, statusFilter]);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    const results: DiagnosticResult[] = [];

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      results.push({
        name: 'Sessão autenticada',
        ok: !!data.session && !sessionError,
        detail: sessionError?.message || (data.session ? 'OK' : 'Sem sessão'),
      });

      const { error: materiasError } = await supabase.from('materias').select('id', { count: 'exact', head: true });
      results.push({
        name: 'Leitura tabela materias',
        ok: !materiasError,
        detail: materiasError?.message || 'OK',
      });

      const { error: logsError } = await supabase.from('upload_logs').select('id').limit(1);
      results.push({
        name: 'Leitura tabela upload_logs',
        ok: !logsError,
        detail: logsError?.message || 'OK',
      });

      const { error: storageError } = await supabase.storage.from('conteudos').list('', { limit: 1 });
      results.push({
        name: 'Acesso ao bucket conteudos',
        ok: !storageError,
        detail: storageError?.message || 'OK',
      });
    } catch (e) {
      results.push({
        name: 'Diagnóstico geral',
        ok: false,
        detail: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setDiagnostics(results);
      setRunningDiagnostics(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const stats = {
    total: logs.length,
    sucesso: logs.filter((l) => l.status === 'sucesso').length,
    erro: logs.filter((l) => l.status === 'erro').length,
    pending: logs.filter((l) => l.status === 'pending').length,
    processing: logs.filter((l) => l.status === 'processing').length,
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  if (!isAdminUser) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Logs de Upload</h1>
          <p className="text-muted-foreground">Histórico completo de uploads e processamentos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-foreground">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Sucesso</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-primary">{stats.sucesso}</div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Erros</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-destructive">{stats.erro}</div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Processando</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">{stats.processing + stats.pending}</div></CardContent></Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Filtros e debug</CardTitle>
                <CardDescription>Filtre os logs e rode testes rápidos de conexão</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={runDiagnostics} variant="secondary" size="sm" disabled={runningDiagnostics}>
                  <Activity className="w-4 h-4 mr-2" />
                  {runningDiagnostics ? 'Testando...' : 'Teste de conexão'}
                </Button>
                <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UploadStatus | 'all')}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sucesso">Sucesso</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {diagnostics.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {diagnostics.map((test) => (
                  <div key={test.name} className={`rounded-md border p-3 text-sm ${test.ok ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="font-medium">{test.ok ? '✅' : '❌'} {test.name}</div>
                    <div className="text-muted-foreground">{test.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{statusFilter === 'all' ? 'Nenhum log encontrado' : `Nenhum log com status "${statusConfig[statusFilter as UploadStatus]?.label || statusFilter}" encontrado`}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const config = statusConfig[log.status] || statusConfig.erro;
              const StatusIcon = config.icon;
              return (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{log.arquivo_nome}</h3>
                          <Badge variant={config.variant} className="flex items-center gap-1"><StatusIcon className="w-3 h-3" />{config.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Tipo: <span className="font-medium">{log.arquivo_tipo}</span></p>
                        <p className="text-sm text-muted-foreground">Data: <span className="font-medium">{formatDate(log.created_at)}</span></p>
                      </div>
                    </div>

                    {log.mensagem && <div className="mb-3"><p className="text-sm text-foreground">{log.mensagem}</p></div>}

                    {log.erro_detalhes && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Detalhes do erro:</strong>
                          <pre className="mt-2 text-xs overflow-x-auto bg-destructive/10 p-2 rounded">{log.erro_detalhes}</pre>
                        </AlertDescription>
                      </Alert>
                    )}

                    {log.aula_criada_id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">Aula criada: <span className="font-medium text-foreground">{log.aula_criada_id}</span></p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
