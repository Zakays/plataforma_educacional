import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ROUTE_PATHS, type Materia } from '@/lib/index';
import { Layout } from '@/components/Layout';
import { IMAGES } from '@/assets/images';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const springPresets = {
  gentle: { type: 'spring' as const, stiffness: 300, damping: 35 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springPresets.gentle,
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaterias = async () => {
      try {
        const { data, error } = await supabase
          .from('materias')
          .select('*')
          .order('nome', { ascending: true });

        if (error) throw error;
        setMaterias(data || []);
      } catch (error) {
        toast({
          title: 'Erro ao carregar matérias',
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMaterias();
  }, [toast]);

  const handleMateriaClick = (materiaId: string) => {
    navigate(ROUTE_PATHS.MATERIA.replace(':id', materiaId));
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: `url(${IMAGES.PLATFORM_UI_2})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/70" />

        <div className="relative z-10">
          <div className="container mx-auto px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springPresets.gentle}
              className="mb-12"
            >
              <h1 className="text-4xl font-bold tracking-tight mb-4">Minhas Matérias</h1>
              <p className="text-lg text-muted-foreground">
                Selecione uma matéria para começar seus estudos
              </p>
            </motion.div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : materias.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springPresets.gentle}
                className="text-center py-24"
              >
                <div
                  className="w-32 h-32 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center"
                  style={{
                    backgroundImage: `url(${IMAGES.VIDEO_DASHBOARD_1})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="w-full h-full rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold mb-2">Nenhuma matéria disponível</h2>
                <p className="text-muted-foreground">
                  Entre em contato com o administrador para adicionar conteúdo
                </p>
              </motion.div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {materias.map((materia) => (
                  <motion.div key={materia.id} variants={staggerItem}>
                    <Card
                      className="overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.97] group"
                      onClick={() => handleMateriaClick(materia.id)}
                      style={{
                        boxShadow:
                          '0 8px 30px -6px color-mix(in srgb, var(--primary) 15%, transparent)',
                      }}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                              {materia.nome}
                            </CardTitle>
                            {materia.descricao && (
                              <CardDescription className="line-clamp-2">
                                {materia.descricao}
                              </CardDescription>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <BookOpen className="w-4 h-4" />
                          <span>Acessar conteúdo</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
