import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { UploadManager } from '@/components/UploadManager';
import { useAuth } from '@/hooks/useAuth';
import { ROUTE_PATHS } from '@/lib/index';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminUpload() {
  const { user, profile, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate(ROUTE_PATHS.LOGIN);
    }
    if (!loading && user && !isAdmin()) {
      navigate(ROUTE_PATHS.DASHBOARD);
    }
  }, [user, profile, loading, isAdmin, navigate]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || !isAdmin()) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Negado</AlertTitle>
            <AlertDescription>
              Você não tem permissão para acessar esta página.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Upload de Arquivos</h1>
          <p className="text-muted-foreground">
            Faça upload de vídeos, PDFs, áudios e outros materiais de estudo. O sistema processará automaticamente os arquivos com base no padrão Aula X.Y.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <UploadManager />
        </div>

        <div className="mt-8 bg-muted/50 border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Instruções de Upload</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <strong className="text-foreground">Padrão de Nomenclatura:</strong>
              <p>Os arquivos devem seguir o padrão "Aula X.Y" onde X é o número da aula e Y é o número da subaula.</p>
              <p className="mt-1 text-xs">Exemplo: "Aula 1.1 - Introdução.mp4"</p>
            </div>
            <div>
              <strong className="text-foreground">Tipos de Arquivo Suportados:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Vídeos: .mp4, .webm, .mov</li>
                <li>PDFs: .pdf</li>
                <li>Áudios: .mp3, .wav, .m4a</li>
              </ul>
            </div>
            <div>
              <strong className="text-foreground">Processamento Automático:</strong>
              <p>O sistema criará automaticamente a aula correspondente se ela não existir e associará o arquivo ao tipo correto.</p>
            </div>
            <div>
              <strong className="text-foreground">Logs de Upload:</strong>
              <p>Todos os uploads são registrados e podem ser visualizados na página de Logs Administrativos.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
