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


const getCloudinaryResourceType = (fileExtension: string): 'video' | 'raw' => {
  if (['mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'm4a', 'aac'].includes(fileExtension)) {
    return 'video';
  }

  return 'raw';
};

const uploadToCloudinary = async (
  file: File,
  path: string,
  fileExtension: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
  const folder = import.meta.env.VITE_CLOUDINARY_FOLDER as string | undefined;

  if (!cloudName || !uploadPreset) {
    return {
      success: false,
      error: 'Cloudinary não configurado. Defina VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET.',
    };
  }

  try {
    const publicId = path.replace(/\.[^.]+$/, '');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('public_id', publicId);
    formData.append('resource_type', getCloudinaryResourceType(fileExtension));

    if (folder) {
      formData.append('folder', folder);
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${getCloudinaryResourceType(fileExtension)}/upload`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.secure_url) {
      throw new Error(result?.error?.message || 'Erro ao enviar arquivo para Cloudinary');
    }

    return {
      success: true,
      url: result.secure_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro no upload para Cloudinary',
    };
  }
};

export const uploadToStorage = async (
  file: File,
  materiaId: string,
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

  const cloudinaryResult = await uploadToCloudinary(file, path, fileExtension);
  if (cloudinaryResult.success) {
    return cloudinaryResult;
  }

  try {
    const { error } = await supabase.storage
      .from('conteudos')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    const { data: urlData } = await supabase.storage
      .from('conteudos')
      .createSignedUrl(path, 3600);

    return {
      success: true,
      url: urlData?.signedUrl,
    };
  } catch (error) {
    const fallbackMessage = error instanceof Error ? error.message : 'Erro no upload';
    return {
      success: false,
      error: `${cloudinaryResult.error || 'Falha no Cloudinary'} | Supabase: ${fallbackMessage}`,
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

const insertMaterial = async ({
  aulaId,
  materiaId,
  tipo,
  titulo,
  url,
}: {
  aulaId?: string | null;
  materiaId?: string;
  tipo: MaterialTipo;
  titulo: string;
  url: string;
}): Promise<boolean> => {
  try {
    const basePayload: Record<string, unknown> = {
      tipo,
      titulo,
      url,
      ordem: 1,
    };

    if (aulaId) basePayload.aula_id = aulaId;
    if (materiaId) basePayload.materia_id = materiaId;

    let response = await supabase.from('materiais_estudo').insert(basePayload as any);

    if (response.error?.code === '42703') {
      const missingColumn = response.error.message.match(/column\s+materiais_estudo\.([a-zA-Z0-9_]+)/i)?.[1];
      if (missingColumn) {
        delete basePayload[missingColumn];
        response = await supabase.from('materiais_estudo').insert(basePayload as any);
      }
    }

    return !response.error;
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
  } else if (['csv'].includes(fileExtension)) {
    fileType = 'csv';
    materialTipo = 'flashcard';
    folder = 'csv';
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
          const videoInserted = await insertVideo(aulaId, aulaInfo.titulo, uploadResult.url!);
          if (!videoInserted) {
            message += ' (erro ao associar vídeo)';
          }
        } else {
          const materialInserted = await insertMaterial({
            aulaId,
            materiaId,
            tipo: materialTipo,
            titulo: aulaInfo.titulo,
            url: uploadResult.url!,
          });
          if (!materialInserted) {
            message += ' (erro ao associar material)';
          }
        }
      } else {
        message += ' - Erro ao criar/buscar aula';
      }
    } else {
      // Inserir apenas como material de estudo geral
      const materialInserted = await insertMaterial({
        aulaId: null,
        materiaId,
        tipo: materialTipo,
        titulo: fileName,
        url: uploadResult.url!,
      });
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