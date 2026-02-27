import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { processFileUpload } from '@/services/uploadService';
import { useAuth } from '@/hooks/useAuth';
import type { Materia } from '@/lib/index';
import { supabase } from '@/lib/supabase';

interface UploadManagerProps {
  materiaId?: string;
}


const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }

  return 'Erro desconhecido';
};

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
  logId?: string;
}

export function UploadManager({ materiaId: propMateriaId }: UploadManagerProps) {
  const { user } = useAuth();
  const [selectedMateriaId, setSelectedMateriaId] = useState<string>(propMateriaId || '');
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingMateria, setIsCreatingMateria] = useState(false);
  const [newMateriaNome, setNewMateriaNome] = useState('');
  const [newMateriaDescricao, setNewMateriaDescricao] = useState('');
  const [newMateriaOrdem, setNewMateriaOrdem] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);


  const fetchMaterias = useCallback(async () => {
    const { data, error } = await supabase
      .from('materias')
      .select('*')
      .order('ordem', { ascending: true });

    if (!error && data) {
      const materiasData = data as Materia[];
      setMaterias(materiasData);
      if (!propMateriaId && !selectedMateriaId && materiasData.length > 0) {
        setSelectedMateriaId(materiasData[0].id);
      }
    }
  }, [propMateriaId, selectedMateriaId]);

  useEffect(() => {
    fetchMaterias();
  }, [fetchMaterias]);


  const handleCreateMateria = async () => {
    const nome = newMateriaNome.trim();

    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da nova matéria.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingMateria(true);

    try {
      const ordemNumber = newMateriaOrdem.trim() ? Number(newMateriaOrdem) : materias.length + 1;
      const materiaPayload: Record<string, string | number | null> = {
        nome,
        descricao: newMateriaDescricao.trim() || null,
        ordem: Number.isFinite(ordemNumber) ? ordemNumber : materias.length + 1,
      };

      let response = await supabase
        .from('materias')
        .insert(materiaPayload as any)
        .select('*')
        .single();

      if (response.error?.code === '42703') {
        const missingColumn = response.error.message.match(/column\s+materias\.([a-zA-Z0-9_]+)/i)?.[1];

        if (missingColumn) {
          delete materiaPayload[missingColumn];

          response = await supabase
            .from('materias')
            .insert(materiaPayload as any)
            .select('*')
            .single();
        }
      }

      if (response.error) throw response.error;

      const createdMateria = response.data as Materia;
      setSelectedMateriaId(createdMateria.id);
      setNewMateriaNome('');
      setNewMateriaDescricao('');
      setNewMateriaOrdem('');
      await fetchMaterias();

      toast({
        title: 'Matéria criada',
        description: `A matéria "${createdMateria.nome}" foi adicionada com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar matéria',
        description: extractErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsCreatingMateria(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      file,
      status: 'pending',
    }));

    setUploadItems((prev) => [...prev, ...newItems]);
  };

  const handleUpload = async () => {
    if (!selectedMateriaId || !user) {
      return;
    }

    setIsUploading(true);

    for (let i = 0; i < uploadItems.length; i++) {
      const item = uploadItems[i];
      if (item.status !== 'pending') continue;

      setUploadItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, status: 'uploading' } : it
        )
      );

      const result = await processFileUpload({
        file: item.file,
        materiaId: selectedMateriaId,
        userId: user.id,
      });

      setUploadItems((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? {
                ...it,
                status: result.success ? 'success' : 'error',
                message: result.error || 'Upload concluído com sucesso',
                logId: result.logId,
              }
            : it
        )
      );
    }

    setIsUploading(false);
  };

  const handleClearCompleted = () => {
    setUploadItems((prev) =>
      prev.filter((item) => item.status === 'pending' || item.status === 'uploading')
    );
  };

  const handleReset = () => {
    setUploadItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const pendingCount = uploadItems.filter((item) => item.status === 'pending').length;
  const successCount = uploadItems.filter((item) => item.status === 'success').length;
  const errorCount = uploadItems.filter((item) => item.status === 'error').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivos</CardTitle>
          <CardDescription>
            Selecione uma matéria e faça upload de vídeos, PDFs, áudios e outros materiais.
            Os arquivos devem seguir o padrão "Aula X.Y" no nome.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {!propMateriaId && (
            <div className="space-y-4 rounded-md border border-border p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Nova Matéria</h3>
                <p className="text-xs text-muted-foreground">
                  Crie uma matéria antes de iniciar o upload, se necessário.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Nome</label>
                  <Input
                    placeholder="Ex: Matemática"
                    value={newMateriaNome}
                    onChange={(e) => setNewMateriaNome(e.target.value)}
                    disabled={isCreatingMateria || isUploading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Ordem (opcional)</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ex: 1"
                    value={newMateriaOrdem}
                    onChange={(e) => setNewMateriaOrdem(e.target.value)}
                    disabled={isCreatingMateria || isUploading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Descrição (opcional)</label>
                <Textarea
                  placeholder="Descrição curta da matéria"
                  value={newMateriaDescricao}
                  onChange={(e) => setNewMateriaDescricao(e.target.value)}
                  disabled={isCreatingMateria || isUploading}
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateMateria}
                disabled={isCreatingMateria || isUploading}
              >
                {isCreatingMateria ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando matéria...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Matéria
                  </>
                )}
              </Button>
            </div>
          )}

          {!propMateriaId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Matéria
              </label>
              <Select value={selectedMateriaId} onValueChange={setSelectedMateriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma matéria" />
                </SelectTrigger>
                <SelectContent>
                  {materias.map((materia) => (
                    <SelectItem key={materia.id} value={materia.id}>
                      {materia.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Arquivos
            </label>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept=".mp4,.webm,.mov,.pdf,.mp3,.wav,.m4a"
              />
              <label htmlFor="file-upload">
                <Button type="button" variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Arquivos
                  </span>
                </Button>
              </label>
              {uploadItems.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || pendingCount === 0 || !selectedMateriaId}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      `Fazer Upload (${pendingCount})`
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearCompleted}
                    disabled={isUploading || (successCount === 0 && errorCount === 0)}
                  >
                    Limpar Concluídos
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isUploading}
                  >
                    Resetar
                  </Button>
                </div>
              )}
            </div>
          </div>

          {uploadItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Arquivos Selecionados ({uploadItems.length})
                </h3>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Pendentes: {pendingCount}</span>
                  <span className="text-green-600">Sucesso: {successCount}</span>
                  <span className="text-red-600">Erros: {errorCount}</span>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2 border rounded-md p-4">
                {uploadItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.file.name}
                        </p>
                        {item.message && (
                          <p
                            className={`text-xs mt-1 ${
                              item.status === 'error'
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {item.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                      )}
                      {item.status === 'uploading' && (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      )}
                      {item.status === 'success' && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {item.status === 'error' && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {uploadItems.length > 0 && errorCount > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {errorCount} arquivo(s) falharam no upload. Verifique os logs para mais detalhes.
          </AlertDescription>
        </Alert>
      )}

      {uploadItems.length > 0 && successCount > 0 && errorCount === 0 && !isUploading && (
        <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            Todos os arquivos foram processados com sucesso!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
