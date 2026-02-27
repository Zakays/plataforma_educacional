import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { UploadLog, UploadStatus } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Clock, XCircle, FileText, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';

const statusConfig: Record<UploadStatus, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' },
  processing: { label: 'Processando', icon: RefreshCw, variant: 'default' },
  sucesso: { label: 'Sucesso', icon: CheckCircle2, variant: 'outline' },
  erro: { label: 'Erro', icon: XCircle, variant: 'destructive' },
};

export default function AdminLogs() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<UploadStatus | 'all'>('all');

  useEffect(() => {
    if (!authLoading && !isAdmin()) {
      navigate(ROUTE_PATHS.DASHBOARD);
    }
  }, [authLoading, isAdmin, navigate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('upload_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setLogs(data || []);
      setFilteredLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin()) {
      fetchLogs();
    }
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter((log) => log.status === statusFilter));
    }
  }, [statusFilter, logs]);

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

  const getStatusStats = () => {
    const stats = {
      total: logs.length,
      sucesso: logs.filter((l) => l.status === 'sucesso').length,
      erro: logs.filter((l) => l.status === 'erro').length,
      pending: logs.filter((l) => l.status === 'pending').length,
      processing: logs.filter((l) => l.status === 'processing').length,
    };
    return stats;
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

  if (!isAdmin()) {
    return null;
  }

  const stats = getStatusStats();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Logs de Upload</h1>
          <p className="text-muted-foreground">Histórico completo de uploads e processamentos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sucesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.sucesso}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Erros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.erro}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processando</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.processing + stats.pending}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>Filtre os logs por status</CardDescription>
              </div>
              <Button onClick={fetchLogs} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UploadStatus | 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {statusFilter === 'all'
                  ? 'Nenhum log encontrado'
                  : `Nenhum log com status "${statusConfig[statusFilter as UploadStatus]?.label || statusFilter}" encontrado`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const config = statusConfig[log.status];
              const StatusIcon = config.icon;

              return (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{log.arquivo_nome}</h3>
                          <Badge variant={config.variant} className="flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Tipo: <span className="font-medium">{log.arquivo_tipo}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Data: <span className="font-medium">{formatDate(log.created_at)}</span>
                        </p>
                      </div>
                    </div>

                    {log.mensagem && (
                      <div className="mb-3">
                        <p className="text-sm text-foreground">{log.mensagem}</p>
                      </div>
                    )}

                    {log.erro_detalhes && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Detalhes do erro:</strong>
                          <pre className="mt-2 text-xs overflow-x-auto bg-destructive/10 p-2 rounded">
                            {log.erro_detalhes}
                          </pre>
                        </AlertDescription>
                      </Alert>
                    )}

                    {log.aula_criada_id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          Aula criada: <span className="font-medium text-foreground">{log.aula_criada_id}</span>
                        </p>
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
