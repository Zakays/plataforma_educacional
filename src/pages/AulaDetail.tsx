import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { VideoPlayer } from '@/components/VideoPlayer';
import { QuizComponent } from '@/components/QuizComponent';
import { FlashcardViewer } from '@/components/FlashcardViewer';
import { supabase, createSignedUrl } from '@/lib/supabase';
import type { Aula, Video, MaterialEstudo, Quiz } from '@/lib/index';
import { formatAulaTitle } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Headphones, Brain, BookOpen, Download, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

const resolveStorageReference = (storedValue: string): { bucket: string; path: string } | null => {
  if (!storedValue) return null;

  if (storedValue.startsWith('http')) {
    try {
      const url = new URL(storedValue);
      const signMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
      if (signMatch) {
        return {
          bucket: decodeURIComponent(signMatch[1]),
          path: decodeURIComponent(signMatch[2]),
        };
      }

      const publicMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (publicMatch) {
        return {
          bucket: decodeURIComponent(publicMatch[1]),
          path: decodeURIComponent(publicMatch[2]),
        };
      }
    } catch {
      return null;
    }
  }

  return null;
};

const buildSignedUrl = async (
  storedValue: string,
  fallbackBucket?: string,
  preferConteudos: boolean = false
): Promise<string | null> => {
  const directReference = resolveStorageReference(storedValue);

  if (directReference) {
    const { data: signedUrl } = await createSignedUrl(directReference.bucket, directReference.path, 7200);
    return signedUrl;
  }

  const bucketsToTry = [
    ...(preferConteudos ? ['conteudos'] : []),
    ...(fallbackBucket ? [fallbackBucket] : []),
    ...(!preferConteudos ? ['conteudos'] : []),
  ];

  for (const bucket of bucketsToTry) {
    const { data: signedUrl } = await createSignedUrl(bucket, storedValue, 7200);
    if (signedUrl) return signedUrl;
  }

  return null;
};


export default function AulaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [aula, setAula] = useState<Aula | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [materiais, setMateriais] = useState<MaterialEstudo[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const loadAulaData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: aulaData, error: aulaError } = await supabase
        .from('aulas')
        .select('*')
        .eq('id', id)
        .single();

      if (aulaError) throw aulaError;
      if (!aulaData) throw new Error('Aula não encontrada');

      setAula(aulaData);

      const { data: videoData } = await supabase
        .from('videos')
        .select('*')
        .eq('aula_id', id)
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (videoData) {
        setVideo(videoData as Video);
        const signedUrl = await buildSignedUrl((videoData as Video).url, 'videos', true);
        if (signedUrl) {
          setSignedUrls(prev => ({ ...prev, [(videoData as Video).id]: signedUrl }));
        }
      }

      const { data: materiaisData } = await supabase
        .from('materiais_estudo')
        .select('*')
        .eq('aula_id', id)
        .order('ordem', { ascending: true });

      if (materiaisData) {
        setMateriais(materiaisData as MaterialEstudo[]);
        for (const material of (materiaisData as MaterialEstudo[])) {
          if (material.url) {
            const fallbackBucket = material.tipo === 'pdf' ? 'pdfs' : material.tipo === 'audio' ? 'audios' : 'mapas';
            const signedUrl = await buildSignedUrl(material.url, fallbackBucket, true);
            if (signedUrl) {
              setSignedUrls(prev => ({ ...prev, [material.id]: signedUrl }));
            }
          }
        }
      }

      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('aula_id', id);

      if (quizzesData) {
        setQuizzes(quizzesData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar aula');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id) {
      navigate('/dashboard');
      return;
    }

    void loadAulaData();
  }, [id, navigate, loadAulaData]);

  const getMaterialIcon = (tipo: string) => {
    switch (tipo) {
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'audio':
        return <Headphones className="w-5 h-5" />;
      case 'mapa_mental':
        return <Brain className="w-5 h-5" />;
      case 'flashcard':
        return <BookOpen className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getMaterialLabel = (tipo: string) => {
    switch (tipo) {
      case 'pdf':
        return 'PDF';
      case 'audio':
        return 'Áudio';
      case 'mapa_mental':
        return 'Mapa Mental';
      case 'flashcard':
        return 'Flashcard';
      default:
        return tipo;
    }
  };

  const pdfs = materiais.filter(m => m.tipo === 'pdf');
  const audios = materiais.filter(m => m.tipo === 'audio');
  const mapas = materiais.filter(m => m.tipo === 'mapa_mental');
  const flashcards = materiais.filter(m => m.tipo === 'flashcard');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Carregando aula...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !aula) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-destructive">Erro</CardTitle>
              <CardDescription>{error || 'Aula não encontrada'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Voltar ao Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              {formatAulaTitle(aula.numero_aula, aula.numero_subaula)}
            </h1>
            {aula.titulo && (
              <h2 className="text-2xl text-muted-foreground font-medium">{aula.titulo}</h2>
            )}
            {aula.descricao && (
              <p className="text-muted-foreground mt-4">{aula.descricao}</p>
            )}
          </div>

          {video && signedUrls[video.id] && (
            <div className="mb-12">
              <Card>
                <CardContent className="p-0">
                  <VideoPlayer
                    videoUrl={signedUrls[video.id]}
                    videoId={video.id}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="materiais" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
              <TabsTrigger value="materiais">Materiais</TabsTrigger>
              {quizzes.length > 0 && <TabsTrigger value="quiz">Quiz</TabsTrigger>}
              {flashcards.length > 0 && <TabsTrigger value="flashcards">Flashcards</TabsTrigger>}
              {(pdfs.length > 0 || audios.length > 0 || mapas.length > 0) && (
                <TabsTrigger value="recursos">Recursos</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="materiais" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pdfs.map((material) => (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            {getMaterialIcon(material.tipo)}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{material.titulo}</CardTitle>
                            <CardDescription>{getMaterialLabel(material.tipo)}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {signedUrls[material.id] && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => window.open(signedUrls[material.id], '_blank')}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Visualizar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = signedUrls[material.id];
                                link.download = material.titulo;
                                link.click();
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Baixar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {audios.map((material) => (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-accent/10 rounded-lg text-accent">
                            {getMaterialIcon(material.tipo)}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{material.titulo}</CardTitle>
                            <CardDescription>{getMaterialLabel(material.tipo)}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {signedUrls[material.id] && (
                          <audio controls className="w-full">
                            <source src={signedUrls[material.id]} />
                            Seu navegador não suporta áudio.
                          </audio>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {mapas.map((material) => (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-secondary/10 rounded-lg text-secondary-foreground">
                            {getMaterialIcon(material.tipo)}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{material.titulo}</CardTitle>
                            <CardDescription>{getMaterialLabel(material.tipo)}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {signedUrls[material.id] && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => window.open(signedUrls[material.id], '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Visualizar Mapa
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {pdfs.length === 0 && audios.length === 0 && mapas.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Nenhum material disponível para esta aula.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {quizzes.length > 0 && (
              <TabsContent value="quiz" className="mt-6">
                <div className="space-y-6">
                  {quizzes.map((quiz) => (
                    <QuizComponent key={quiz.id} quizId={quiz.id} />
                  ))}
                </div>
              </TabsContent>
            )}

            {flashcards.length > 0 && (
              <TabsContent value="flashcards" className="mt-6">
                <div className="space-y-6">
                  {flashcards.map((material) => (
                    <Card key={material.id}>
                      <CardHeader>
                        <CardTitle>{material.titulo}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {material.conteudo && Array.isArray(material.conteudo) && (
                          <FlashcardViewer flashcards={material.conteudo} />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            )}

            {(pdfs.length > 0 || audios.length > 0 || mapas.length > 0) && (
              <TabsContent value="recursos" className="mt-6">
                <div className="space-y-6">
                  {pdfs.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          PDFs
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {pdfs.map((material) => (
                            <div
                              key={material.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <span className="font-medium">{material.titulo}</span>
                              {signedUrls[material.id] && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(signedUrls[material.id], '_blank')}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = signedUrls[material.id];
                                      link.download = material.titulo;
                                      link.click();
                                    }}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {audios.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Headphones className="w-5 h-5" />
                          Áudios
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {audios.map((material) => (
                            <div key={material.id} className="space-y-2">
                              <p className="font-medium">{material.titulo}</p>
                              {signedUrls[material.id] && (
                                <audio controls className="w-full">
                                  <source src={signedUrls[material.id]} />
                                  Seu navegador não suporta áudio.
                                </audio>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {mapas.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          Mapas Mentais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {mapas.map((material) => (
                            <div
                              key={material.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <span className="font-medium">{material.titulo}</span>
                              {signedUrls[material.id] && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(signedUrls[material.id], '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}
