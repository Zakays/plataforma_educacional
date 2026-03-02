import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Quiz, QuizAttempt } from '@/lib/index';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizComponentProps {
  quizId: string;
}

const normalizeQuiz = (raw: unknown): Quiz => {
  const source = (raw ?? {}) as Record<string, any>;
  const hasQuestoesArray = Array.isArray(source?.questoes);

  if (hasQuestoesArray) {
    return {
      ...source,
      questoes: source.questoes.map((q: any, index: number) => ({
        id: q?.id || `${String(source.id || 'quiz')}-q-${index}`,
        pergunta: q?.pergunta || '',
        opcoes: Array.isArray(q?.opcoes) ? q.opcoes : [q?.opcao_a || '', q?.opcao_b || '', q?.opcao_c || '', q?.opcao_d || ''],
        resposta_correta:
          typeof q?.resposta_correta === 'number'
            ? q.resposta_correta
            : ['a', 'b', 'c', 'd'].indexOf(String(q?.resposta_correta || '').toLowerCase()),
      })),
    } as Quiz;
  }

  const respostaRaw = String(source?.resposta_correta || '').toLowerCase();
  const respostaCorreta = Number.isInteger(source?.resposta_correta)
    ? Number(source.resposta_correta)
    : Math.max(0, ['a', 'b', 'c', 'd'].indexOf(respostaRaw));

  return {
    ...source,
    titulo: source?.titulo || 'Quiz',
    questoes: [
      {
        id: source?.id || `${source?.aula_id || 'quiz'}-q-0`,
        pergunta: source?.pergunta || 'Pergunta sem enunciado',
        opcoes: [source?.opcao_a || '', source?.opcao_b || '', source?.opcao_c || '', source?.opcao_d || ''],
        resposta_correta: respostaCorreta,
      },
    ],
  } as Quiz;
};

export function QuizComponent({ quizId }: QuizComponentProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<{
    pontuacao: number;
    total: number;
    respostasCorretas: Record<string, boolean>;
  } | null>(null);
  const [tentativaAnterior, setTentativaAnterior] = useState<QuizAttempt | null>(null);

  const loadQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Quiz não encontrado');

      setQuiz(normalizeQuiz(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar quiz');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  const loadTentativaAnterior = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (data) setTentativaAnterior(data);
    } catch (err) {
      console.error('Erro ao carregar tentativa anterior:', err);
    }
  }, [quizId]);

  useEffect(() => {
    void loadQuiz();
    void loadTentativaAnterior();
  }, [loadQuiz, loadTentativaAnterior]);

  const handleRespostaChange = (questaoId: string, opcaoIndex: number) => {
    setRespostas(prev => ({
      ...prev,
      [questaoId]: opcaoIndex,
    }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    const totalQuestoes = quiz.questoes.length;
    const respostasCount = Object.keys(respostas).length;

    if (respostasCount < totalQuestoes) {
      setError(`Por favor, responda todas as ${totalQuestoes} questões antes de enviar.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let pontuacao = 0;
      const respostasCorretas: Record<string, boolean> = {};

      quiz.questoes.forEach(questao => {
        const respostaUsuario = respostas[questao.id];
        const correto = respostaUsuario === questao.resposta_correta;
        respostasCorretas[questao.id] = correto;
        if (correto) pontuacao++;
      });

      const insertData = {
        quiz_id: quizId,
        user_id: user.id,
        respostas,
        pontuacao,
        total_questoes: totalQuestoes,
        completed_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('quiz_attempts').insert(insertData as any);

      if (insertError) throw insertError;

      setResultado({
        pontuacao,
        total: totalQuestoes,
        respostasCorretas,
      });

      await loadTentativaAnterior();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setRespostas({});
    setResultado(null);
    setError(null);
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error && !quiz) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!quiz) return null;

  const percentual = resultado
    ? Math.round((resultado.pontuacao / resultado.total) * 100)
    : tentativaAnterior
    ? Math.round((tentativaAnterior.pontuacao / tentativaAnterior.total_questoes) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{quiz.titulo}</CardTitle>
          {tentativaAnterior && !resultado && (
            <CardDescription>
              Última tentativa: {tentativaAnterior.pontuacao}/{tentativaAnterior.total_questoes} ({percentual}%)
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-8">
          {quiz.questoes.map((questao, index) => {
            const respostaUsuario = respostas[questao.id];
            const correto = resultado?.respostasCorretas[questao.id];
            const mostrarFeedback = resultado !== null;

            return (
              <motion.div
                key={questao.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-base font-medium leading-relaxed">{questao.pergunta}</p>
                  </div>
                  {mostrarFeedback && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      {correto ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive" />
                      )}
                    </motion.div>
                  )}
                </div>

                <RadioGroup
                  value={respostaUsuario?.toString()}
                  onValueChange={(value) => handleRespostaChange(questao.id, parseInt(value))}
                  disabled={mostrarFeedback}
                  className="ml-11 space-y-3"
                >
                  {questao.opcoes.map((opcao, opcaoIndex) => {
                    const isSelected = respostaUsuario === opcaoIndex;
                    const isCorrect = opcaoIndex === questao.resposta_correta;
                    const showCorrect = mostrarFeedback && isCorrect;
                    const showIncorrect = mostrarFeedback && isSelected && !isCorrect;

                    return (
                      <div
                        key={opcaoIndex}
                        className={`flex items-center space-x-3 rounded-lg border p-4 transition-all ${
                          showCorrect
                            ? 'border-green-600 bg-green-50'
                            : showIncorrect
                            ? 'border-destructive bg-destructive/5'
                            : isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={opcaoIndex.toString()} id={`${questao.id}-${opcaoIndex}`} />
                        <Label
                          htmlFor={`${questao.id}-${opcaoIndex}`}
                          className="flex-1 cursor-pointer text-sm leading-relaxed"
                        >
                          {opcao}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </motion.div>
            );
          })}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}

            {resultado && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full"
              >
                <Alert className={percentual >= 70 ? 'border-green-600 bg-green-50' : 'border-orange-600 bg-orange-50'}>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    Você acertou {resultado.pontuacao} de {resultado.total} questões ({percentual}%)
                    {percentual >= 70 ? ' - Parabéns!' : ' - Continue estudando!'}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex w-full gap-3">
            {!resultado ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting || Object.keys(respostas).length < quiz.questoes.length}
                className="flex-1"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Respostas'
                )}
              </Button>
            ) : (
              <Button onClick={handleReset} variant="outline" className="flex-1" size="lg">
                <RotateCcw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
