import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { ROUTE_PATHS, formatAulaTitle } from '@/lib/index';
import type { Materia, Aula, Video, MaterialEstudo, Quiz } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlayCircle, FileText, Headphones, Brain, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';


const isMissingColumnError = (error: { code?: string } | null): boolean => error?.code === '42703';

interface AulaWithContent extends Aula {
  videos: Video[];
  materiais: MaterialEstudo[];
  quizzes: Quiz[];
}

export default function MateriaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [materia, setMateria] = useState<Materia | null>(null);
  const [aulas, setAulas] = useState<AulaWithContent[]>([]);
  const [materiaisGerais, setMateriaisGerais] = useState<MaterialEstudo[]>([]);
  const [quizzesGerais, setQuizzesGerais] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('videos');

  useEffect(() => {
    if (!id) {
      navigate(ROUTE_PATHS.DASHBOARD);
      return;
    }
    loadMateriaData();
  }, [id]);

  const loadMateriaData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: materiaData, error: materiaError } = await supabase
        .from('materias')
        .select('*')
        .eq('id', id)
        .single();

      if (materiaError) throw materiaError;
      if (!materiaData) throw new Error('Matéria não encontrada');

      setMateria(materiaData);

      let aulasQuery = await supabase
        .from('aulas')
        .select('*')
        .eq('materia_id', id)
        .order('ordem', { ascending: true });

      if (isMissingColumnError(aulasQuery.error)) {
        aulasQuery = await supabase
          .from('aulas')
          .select('*')
          .eq('materia_id', id);
      }

      if (aulasQuery.error) throw aulasQuery.error;

      const aulasWithContent: AulaWithContent[] = await Promise.all(
        (aulasQuery.data || []).map(async (aula) => {
          const [videosOrdered, materiaisOrdered, quizzesResult] = await Promise.all([
            supabase
              .from('videos')
              .select('*')
              .eq('aula_id', aula.id)
              .order('ordem', { ascending: true }),
            supabase
              .from('materiais_estudo')
              .select('*')
              .eq('aula_id', aula.id)
              .order('ordem', { ascending: true }),
            supabase
              .from('quizzes')
              .select('*')
              .eq('aula_id', aula.id),
          ]);

          const videosResult = isMissingColumnError(videosOrdered.error)
            ? await supabase.from('videos').select('*').eq('aula_id', aula.id)
            : videosOrdered;

          const materiaisResult = isMissingColumnError(materiaisOrdered.error)
            ? await supabase.from('materiais_estudo').select('*').eq('aula_id', aula.id)
            : materiaisOrdered;

          return {
            ...aula,
            videos: videosResult.data || [],
            materiais: materiaisResult.data || [],
            quizzes: quizzesResult.data || [],
          };
        })
      );

      setAulas(aulasWithContent);

      let materiaisGeraisQuery = await supabase
        .from('materiais_estudo')
        .select('*')
        .eq('materia_id', id)
        .is('aula_id', null)
        .order('ordem', { ascending: true });

      if (isMissingColumnError(materiaisGeraisQuery.error)) {
        materiaisGeraisQuery = await supabase
          .from('materiais_estudo')
          .select('*')
          .eq('materia_id', id)
          .is('aula_id', null);
      }

      if (!materiaisGeraisQuery.error && materiaisGeraisQuery.data) {
        setMateriaisGerais(materiaisGeraisQuery.data as MaterialEstudo[]);
      } else {
        setMateriaisGerais([]);
      }


      const { data: quizzesGeraisData, error: quizzesGeraisError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('materia_id', id)
        .is('aula_id', null);

      if (!quizzesGeraisError && quizzesGeraisData) {
        setQuizzesGerais(quizzesGeraisData as Quiz[]);
      } else {
        setQuizzesGerais([]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar matéria');
    } finally {
      setLoading(false);
    }
  };

  const getVideoAulas = () => aulas.filter((aula) => aula.videos.length > 0);
  const getQuizAulas = () => aulas.filter((aula) => aula.quizzes.length > 0);
  const getAudioAulas = () => aulas.filter((aula) => aula.materiais.some((m) => m.tipo === 'audio'));
  const getPdfAulas = () => aulas.filter((aula) => aula.materiais.some((m) => m.tipo === 'pdf'));

  const totalVideos =
    aulas.reduce((total, aula) => total + aula.videos.length, 0) +
    materiaisGerais.filter((m) => m.tipo === 'video').length;
  const totalQuizzes =
    aulas.reduce((total, aula) => total + aula.quizzes.length, 0) + quizzesGerais.length;
  const totalAudios =
    aulas.reduce((total, aula) => total + aula.materiais.filter((m) => m.tipo === 'audio').length, 0) +
    materiaisGerais.filter((m) => m.tipo === 'audio').length;
  const totalPdfs =
    aulas.reduce((total, aula) => total + aula.materiais.filter((m) => m.tipo === 'pdf').length, 0) +
    materiaisGerais.filter((m) => m.tipo === 'pdf').length;

  const handleAulaClick = (aulaId: string) => {
    if (!id) return;
    navigate(
      ROUTE_PATHS.AULA.replace(':materiaId', id).replace(':aulaId', aulaId)
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !materia) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Matéria não encontrada'}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => navigate(ROUTE_PATHS.DASHBOARD)}
            className="mt-4"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              {materia.nome}
            </h1>
            {materia.descricao && (
              <p className="text-lg text-muted-foreground">
                {materia.descricao}
              </p>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="videos" className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                Vídeos ({totalVideos})
              </TabsTrigger>
              <TabsTrigger value="quiz" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Quiz ({totalQuizzes})
              </TabsTrigger>
              <TabsTrigger value="audios" className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Áudios ({totalAudios})
              </TabsTrigger>
              <TabsTrigger value="pdfs" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDFs ({totalPdfs})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-4">
              {totalVideos === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <PlayCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhum vídeo disponível nesta matéria
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {getVideoAulas().map((aula) => (
                    <motion.div
                      key={aula.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
                        onClick={() => handleAulaClick(aula.id)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <PlayCircle className="h-5 w-5 text-primary" />
                            {formatAulaTitle(aula.numero_aula, aula.numero_subaula)}
                          </CardTitle>
                          <CardDescription>{aula.titulo}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {aula.videos.length} vídeo{aula.videos.length !== 1 ? 's' : ''}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {materiaisGerais.filter((m) => m.tipo === 'video').length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <PlayCircle className="h-5 w-5 text-primary" />
                          Vídeos gerais da matéria
                        </CardTitle>
                        <CardDescription>Vídeos sem associação com aula específica</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {materiaisGerais.filter((m) => m.tipo === 'video').length} vídeo(s)
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="quiz" className="space-y-4">
              {totalQuizzes === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhum quiz disponível nesta matéria
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {getQuizAulas().map((aula) => (
                    <motion.div
                      key={aula.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
                        onClick={() => handleAulaClick(aula.id)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            {formatAulaTitle(aula.numero_aula, aula.numero_subaula)}
                          </CardTitle>
                          <CardDescription>{aula.titulo}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {aula.quizzes.length} quiz{aula.quizzes.length !== 1 ? 'zes' : ''}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {quizzesGerais.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-primary" />
                          Quiz geral da matéria
                        </CardTitle>
                        <CardDescription>Quizzes sem associação com aula específica</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{quizzesGerais.length} quiz(es)</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="audios" className="space-y-4">
              {totalAudios === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Headphones className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhum áudio disponível nesta matéria
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {getAudioAulas().map((aula) => {
                    const audioCount = aula.materiais.filter((m) => m.tipo === 'audio').length;
                    return (
                      <motion.div
                        key={aula.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card
                          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
                          onClick={() => handleAulaClick(aula.id)}
                        >
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Headphones className="h-5 w-5 text-primary" />
                              {formatAulaTitle(aula.numero_aula, aula.numero_subaula)}
                            </CardTitle>
                            <CardDescription>{aula.titulo}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{audioCount} áudio{audioCount !== 1 ? 's' : ''}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {materiaisGerais.filter((m) => m.tipo === 'audio').length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Headphones className="h-5 w-5 text-primary" />
                          Materiais gerais da matéria
                        </CardTitle>
                        <CardDescription>Arquivos sem associação com aula específica</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {materiaisGerais.filter((m) => m.tipo === 'audio').length} áudio(s)
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="pdfs" className="space-y-4">
              {totalPdfs === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhum PDF disponível nesta matéria
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {getPdfAulas().map((aula) => {
                    const pdfCount = aula.materiais.filter((m) => m.tipo === 'pdf').length;
                    return (
                      <motion.div
                        key={aula.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card
                          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
                          onClick={() => handleAulaClick(aula.id)}
                        >
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-primary" />
                              {formatAulaTitle(aula.numero_aula, aula.numero_subaula)}
                            </CardTitle>
                            <CardDescription>{aula.titulo}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{pdfCount} PDF{pdfCount !== 1 ? 's' : ''}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {materiaisGerais.filter((m) => m.tipo === 'pdf').length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          Materiais gerais da matéria
                        </CardTitle>
                        <CardDescription>Arquivos sem associação com aula específica</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {materiaisGerais.filter((m) => m.tipo === 'pdf').length} PDF(s)
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}
