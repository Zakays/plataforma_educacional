import { supabase } from '@/lib/supabase';
import type { UploadStatus, MaterialTipo } from '@/lib/index';

export interface UploadFileParams {
  file: File;
  materiaId: string;
  userId: string;
}

export interface UploadResult {
  success: boolean;
  error?: string;
  logId?: string;
}

export const parseFileName = (fileName: string): {
  numeroAula: number;
  numeroSubaula: number;
  titulo: string;
} | null => {
  const regex = /Aula\s+(\d+)\.(\d+)\s+-\s+(.+)/i;
  const match = fileName.match(regex);
  
  if (!match) return null;
  
  return {
    numeroAula: parseInt(match[1], 10),
    numeroSubaula: parseInt(match[2], 10),
    titulo: match[3].trim(),
  };
};

export const uploadToStorage = async (
  file: File,
  materiaId: string,
  path: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.storage
      .from('conteudos')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    return {
      success: true,
      path: data?.path || path,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro no upload',
    };
  }
};

const logUpload = async (
  userId: string,
  materiaId: string,
  fileName: string,
  fileType: string,
  status: UploadStatus,
  message: string,
  errorDetails?: string,
  aulaId?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('upload_logs')
      .insert({
        user_id: userId,
        materia_id: materiaId,
        arquivo_nome: fileName,
        arquivo_tipo: fileType,
        status,
        mensagem: message,
        erro_detalhes: errorDetails || '',
        aula_criada_id: aulaId || '',
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Erro ao salvar log:', error);
    return null;
  }
};

const getOrCreateAula = async (
  materiaId: string,
  numeroAula: number,
  numeroSubaula: number,
  titulo: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('get_or_create_aula' as any, {
      p_materia_id: materiaId,
      p_aula_numero: numeroAula,
      p_assunto_numero: numeroSubaula,
      p_titulo: titulo,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao criar/buscar aula:', error);
    return null;
  }
};

const insertVideo = async (aulaId: string, titulo: string, url: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('videos').insert({
      aula_id: aulaId,
      titulo,
      url,
      ordem: 1,
    } as any);

    return !error;
  } catch (error) {
    console.error('Erro ao inserir vídeo:', error);
    return false;
  }
};

const insertMaterial = async (
  aulaId: string,
  tipo: MaterialTipo,
  titulo: string,
  url: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('materiais_estudo').insert({
      aula_id: aulaId,
      tipo,
      titulo,
      url,
      ordem: 1,
    } as any);

    return !error;
  } catch (error) {
    console.error('Erro ao inserir material:', error);
    return false;
  }
};

export const processFileUpload = async ({
  file,
  materiaId,
  userId,
}: UploadFileParams): Promise<UploadResult> => {
  const fileName = file.name;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Determinar tipo do arquivo
  let fileType: string;
  let materialTipo: MaterialTipo;
  let folder: string;

  if (['mp4', 'webm', 'mov', 'avi'].includes(fileExtension)) {
    fileType = 'video';
    materialTipo = 'video';
    folder = 'videos';
  } else if (['pdf'].includes(fileExtension)) {
    fileType = 'pdf';
    materialTipo = 'pdf';
    folder = 'pdfs';
  } else if (['mp3', 'wav', 'm4a', 'aac'].includes(fileExtension)) {
    fileType = 'audio';
    materialTipo = 'audio';
    folder = 'audios';
  } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExtension)) {
    fileType = 'mapa_mental';
    materialTipo = 'mapa_mental';
    folder = 'mapas';
  } else {
    const logId = await logUpload(
      userId,
      materiaId,
      fileName,
      fileExtension,
      'erro',
      'Tipo de arquivo não suportado',
      `Extensão: ${fileExtension}`
    );
    return {
      success: false,
      error: 'Tipo de arquivo não suportado',
      logId: logId || undefined,
    };
  }

  try {
    // Parse do nome do arquivo
    const aulaInfo = parseFileName(fileName);
    
    // Upload do arquivo
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${materiaId}/${folder}/${timestamp}_${sanitizedFileName}`;
    
    const uploadResult = await uploadToStorage(file, materiaId, storagePath);
    
    if (!uploadResult.success) {
      const logId = await logUpload(
        userId,
        materiaId,
        fileName,
        fileType,
        'erro',
        'Falha no upload para storage',
        uploadResult.error
      );
      return {
        success: false,
        error: uploadResult.error,
        logId: logId || undefined,
      };
    }

    let aulaId: string | null = null;
    let message = 'Upload realizado com sucesso';

    // Se seguir o padrão Aula X.Y, criar/buscar aula
    if (aulaInfo) {
      aulaId = await getOrCreateAula(
        materiaId,
        aulaInfo.numeroAula,
        aulaInfo.numeroSubaula,
        aulaInfo.titulo
      );

      if (aulaId) {
        message += ` - Aula ${aulaInfo.numeroAula}.${aulaInfo.numeroSubaula} associada`;
        
        // Inserir registro específico por tipo
        if (fileType === 'video') {
          const videoInserted = await insertVideo(aulaId, aulaInfo.titulo, uploadResult.path!);
          if (!videoInserted) {
            message += ' (erro ao associar vídeo)';
          }
        } else {
          const materialInserted = await insertMaterial(
            aulaId,
            materialTipo,
            aulaInfo.titulo,
            uploadResult.path!
          );
          if (!materialInserted) {
            message += ' (erro ao associar material)';
          }
        }
      } else {
        message += ' - Erro ao criar/buscar aula';
      }
    } else {
      // Inserir apenas como material de estudo geral
      const materialInserted = await insertMaterial(
        materiaId, // usar materiaId como aula_id quando não há padrão
        materialTipo,
        fileName,
        uploadResult.path!
      );
      if (!materialInserted) {
        message += ' (erro ao associar material)';
      }
    }

    const logId = await logUpload(
      userId,
      materiaId,
      fileName,
      fileType,
      'sucesso',
      message,
      undefined,
      aulaId || undefined
    );

    return {
      success: true,
      logId: logId || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const logId = await logUpload(
      userId,
      materiaId,
      fileName,
      fileType,
      'erro',
      'Erro durante processamento',
      errorMessage
    );

    return {
      success: false,
      error: errorMessage,
      logId: logId || undefined,
    };
  }
};
