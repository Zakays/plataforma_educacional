import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface FlashcardViewerProps {
  flashcards: Array<{ frente: string; verso: string }>;
}

export function FlashcardViewer({ flashcards }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Nenhum flashcard disponível</p>
      </Card>
    );
  }

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Flashcard {currentIndex + 1} de {flashcards.length}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFlip}
          className="gap-2"
        >
          <RotateCw className="h-4 w-4" />
          Virar
        </Button>
      </div>

      <div
        className="relative h-80 cursor-pointer"
        onClick={handleFlip}
        style={{ perspective: '1000px' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isFlipped ? 'verso' : 'frente'}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Card className="h-full flex items-center justify-center p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-2 hover:border-primary/30 transition-colors">
              <div className="text-center space-y-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isFlipped ? 'Resposta' : 'Pergunta'}
                </p>
                <p className="text-2xl font-semibold leading-relaxed">
                  {isFlipped ? currentCard.verso : currentCard.frente}
                </p>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        <div className="flex gap-1">
          {flashcards.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setIsFlipped(false);
              }}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted hover:bg-muted-foreground/30'
              }`}
              aria-label={`Ir para flashcard ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          onClick={handleNext}
          disabled={currentIndex === flashcards.length - 1}
          className="gap-2"
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Clique no card ou no botão "Virar" para ver a resposta
        </p>
      </div>
    </div>
  );
}
