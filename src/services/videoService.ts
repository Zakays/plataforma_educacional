import { supabase } from '@/lib/supabase';
import type { VideoProgress } from '@/lib/index';

export const getVideoProgress = async (
  videoId: string,
  userId: string
): Promise<VideoProgress | null> => {
  try {
    const { data, error } = await supabase
      .from('video_progress')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error('Erro ao buscar progresso do vídeo:', error);
    return null;
  }
};

export const saveVideoProgress = async (
  videoId: string,
  userId: string,
  progressoSegundos: number,
  duracaoTotal: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar se já existe progresso
    const existingProgress = await getVideoProgress(videoId, userId);

    if (existingProgress) {
      // Atualizar progresso existente
      const { error } = await supabase
        .from('video_progress')
        .update({
          progresso_segundos: progressoSegundos,
          duracao_total: duracaoTotal,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', existingProgress.id);

      if (error) throw error;
    } else {
      // Criar novo registro de progresso
      const { error } = await supabase.from('video_progress').insert({
        video_id: videoId,
        user_id: userId,
        progresso_segundos: progressoSegundos,
        duracao_total: duracaoTotal,
        concluido: false,
      } as any);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao salvar progresso',
    };
  }
};

export const markVideoComplete = async (
  videoId: string,
  userId: string,
  duracaoTotal: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar se já existe progresso
    const existingProgress = await getVideoProgress(videoId, userId);

    if (existingProgress) {
      // Atualizar como concluído
      const { error } = await supabase
        .from('video_progress')
        .update({
          progresso_segundos: duracaoTotal,
          duracao_total: duracaoTotal,
          concluido: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', existingProgress.id);

      if (error) throw error;
    } else {
      // Criar novo registro já concluído
      const { error } = await supabase.from('video_progress').insert({
        video_id: videoId,
        user_id: userId,
        progresso_segundos: duracaoTotal,
        duracao_total: duracaoTotal,
        concluido: true,
      } as any);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao marcar como concluído',
    };
  }
};

export const getVideoProgressPercentage = (progress: VideoProgress): number => {
  if (!progress.duracao_total || progress.duracao_total === 0) return 0;
  return Math.round((progress.progresso_segundos / progress.duracao_total) * 100);
};

export const isVideoComplete = (progress: VideoProgress): boolean => {
  return progress.concluido || getVideoProgressPercentage(progress) >= 90;
};
