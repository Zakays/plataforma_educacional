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


interface ParsedQuizQuestion {
  pergunta: string;
  opcoes: string[];
  resposta_correta: number;
}

interface ParsedFlashcard {
  frente: string;
  verso: string;
}

const parseCsvRows = (content: string): string[][] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[;,]/).map((cell) => cell.trim()));
};

const parseQuizCsv = (content: string): ParsedQuizQuestion[] => {
  const rows = parseCsvRows(content);
  if (rows.length <= 1) return [];

  const dataRows = rows.slice(1);

  return dataRows
    .map((row) => {
      const [pergunta, opcaoA, opcaoB, opcaoC, opcaoD, resposta] = row;
      const responseRaw = (resposta || '').trim().toLowerCase();
      const indexFromLetter = ['a', 'b', 'c', 'd'].indexOf(responseRaw);
      const indexFromNumber = Number.parseInt(responseRaw, 10) - 1;
      const respostaCorreta = indexFromLetter >= 0 ? indexFromLetter : indexFromNumber;

      return {
        pergunta: pergunta || '',
        opcoes: [opcaoA || '', opcaoB || '', opcaoC || '', opcaoD || ''],
        resposta_correta: Number.isInteger(respostaCorreta) && respostaCorreta >= 0 ? respostaCorreta : 0,
      };
    })
    .filter((q) => q.pergunta && q.opcoes.some(Boolean));
};

const parseFlashcardsCsv = (content: string): ParsedFlashcard[] => {
  const rows = parseCsvRows(content);
  if (rows.length <= 1) return [];

  return rows
    .slice(1)
    .map((row) => ({
      frente: row[0] || '',
      verso: row[1] || '',
    }))
    .filter((card) => card.frente && card.verso);
};

export const parseFileName = (fileName: string): {
  numeroAula: number;
  numeroSubaula: number;
  titulo: string;
} | null => {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '');
  const normalized = nameWithoutExtension.replace(/[_]+/g, ' ').trim();
  const regex = /Aula\s+(\d+)\.(\d+)\s*[-–—:]\s*(.+)/i;
  const match = normalized.match(regex);

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
    // Schema atual do projeto usa nome_arquivo/tipo/mensagem_erro.
    // Mantemos fallback para nomes antigos para compatibilidade.
    let insertResult = await supabase
      .from('upload_logs')
      .insert({
        user_id: userId,
        nome_arquivo: fileName,
        tipo: fileType,
        status,
        mensagem_erro: status === 'erro' ? (errorDetails || message) : null,
      } as any)
      .select()
      .single();

    if (insertResult.error?.code === '42703') {
      insertResult = await supabase
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
    }

    if (insertResult.error) throw insertResult.error;
    return insertResult.data?.id || null;
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

    if (!error && data) return data;
  } catch {
    // fallback below
  }

  try {
    let findQuery = await supabase
      .from('aulas')
      .select('id')
      .eq('materia_id', materiaId)
      .eq('numero_aula', numeroAula)
      .eq('numero_subaula', numeroSubaula)
      .maybeSingle();

    if (findQuery.error?.code === '42703') {
      findQuery = await supabase
        .from('aulas')
        .select('id')
        .eq('materia_id', materiaId)
        .eq('aula_numero', numeroAula)
        .eq('assunto_numero', numeroSubaula)
        .maybeSingle();
    }

    if (findQuery.data?.id) return findQuery.data.id;

    const payload: Record<string, unknown> = {
      materia_id: materiaId,
      numero_aula: numeroAula,
      numero_subaula: numeroSubaula,
      titulo,
      ordem: numeroAula * 100 + numeroSubaula,
    };

    let insertResult = await supabase.from('aulas').insert(payload as any).select('id').single();

    if (insertResult.error?.code === '42703') {
      const missingColumn = getMissingColumnName(insertResult.error.message);
      if (missingColumn === 'numero_aula') {
        delete payload.numero_aula;
        delete payload.numero_subaula;
        payload.aula_numero = numeroAula;
        payload.assunto_numero = numeroSubaula;
      } else if (missingColumn) {
        delete payload[missingColumn];
      }
      insertResult = await supabase.from('aulas').insert(payload as any).select('id').single();
    }

    if (insertResult.error) throw insertResult.error;
    return insertResult.data?.id || null;
  } catch (error) {
    console.error('Erro ao criar/buscar aula:', error);
    return null;
  }
};


const getMissingColumnName = (message?: string): string | null => {
  if (!message) return null;
  return message.match(/column\s+[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)/i)?.[1] || null;
};

const insertVideo = async (
  aulaId: string,
  _titulo: string,
  url: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload: Record<string, unknown> = {
      aula_id: aulaId,
      url_storage: url,
    };

    let response = await supabase.from('videos').insert(payload as any);

    for (let i = 0; i < 6 && response.error; i++) {
      if (response.error.code === '42703') {
        const missingColumn = getMissingColumnName(response.error.message);
        if (!missingColumn) break;

        if (missingColumn === 'url_storage') {
          delete payload.url_storage;
          payload.url = url;
        } else {
          delete payload[missingColumn];
        }

        response = await supabase.from('videos').insert(payload as any);
        continue;
      }

      if (response.error.code === '23502' && response.error.message.includes('url_storage')) {
        payload.url_storage = url;
        response = await supabase.from('videos').insert(payload as any);
        continue;
      }

      break;
    }

    if (response.error) {
      return { success: false, error: `${response.error.code || 'DB'}: ${response.error.message}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao inserir vídeo';
    console.error('Erro ao inserir vídeo:', error);
    return { success: false, error: message };
  }
};

const insertMaterial = async ({
  aulaId,
  materiaId,
  tipo,
  titulo,
  url,
  conteudo,
}: {
  aulaId?: string | null;
  materiaId?: string;
  tipo: MaterialTipo;
  titulo: string;
  url: string;
  conteudo?: unknown;
}): Promise<boolean> => {
  try {
    const dbTipo = tipo === 'flashcard' ? 'flashcard_csv' : tipo;

    const basePayload: Record<string, unknown> = {
      tipo: dbTipo,
      titulo,
      url_storage: url,
    };


    if (aulaId) basePayload.aula_id = aulaId;
    if (materiaId) basePayload.materia_id = materiaId;

    let response = await supabase.from('materiais_estudo').insert(basePayload as any);

    if (response.error?.code === '42703') {
      const missingColumn = getMissingColumnName(response.error.message);

      if (missingColumn === 'url_storage') {
        delete basePayload.url_storage;
        basePayload.url = url;
      } else if (missingColumn) {
        delete basePayload[missingColumn];
      }

      response = await supabase.from('materiais_estudo').insert(basePayload as any);
    }

    return !response.error;
  } catch (error) {
    console.error('Erro ao inserir material:', error);
    return false;
  }
};


const insertQuiz = async ({
  aulaId,
  materiaId,
  titulo,
  questoes,
}: {
  aulaId?: string | null;
  materiaId?: string;
  titulo: string;
  questoes: ParsedQuizQuestion[];
}): Promise<boolean> => {
  try {
    if (questoes.length === 0) return false;

    const payload: Record<string, unknown> = {
      titulo,
      questoes,
    };

    if (aulaId) payload.aula_id = aulaId;
    if (materiaId) payload.materia_id = materiaId;

    let response = await supabase.from('quizzes').insert(payload as any);

    if (!response.error) return true;

    const rowPayload = questoes.map((q) => {
      const row: Record<string, unknown> = {
        pergunta: q.pergunta,
        opcao_a: q.opcoes[0] || '',
        opcao_b: q.opcoes[1] || '',
        opcao_c: q.opcoes[2] || '',
        opcao_d: q.opcoes[3] || '',
        resposta_correta: q.resposta_correta,
        titulo,
      };
      if (aulaId) row.aula_id = aulaId;
      if (materiaId) row.materia_id = materiaId;
      return row;
    });

    if (response.error?.code === '42703') {
      const missingColumn = getMissingColumnName(response.error.message);

      if (missingColumn && missingColumn !== 'questoes') {
        delete payload[missingColumn];
        response = await supabase.from('quizzes').insert(payload as any);

        if (!response.error) return true;
      }
    }

    response = await supabase.from('quizzes').insert(rowPayload as any);

    if (response.error?.code === '42703') {
      const missingColumn = getMissingColumnName(response.error.message);

      if (missingColumn) {
        const sanitizedRowPayload = rowPayload.map((row) => {
          const clone = { ...row };
          delete clone[missingColumn];
          return clone;
        });

        response = await supabase.from('quizzes').insert(sanitizedRowPayload as any);
      }
    }

    return !response.error;
  } catch (error) {
    console.error('Erro ao inserir quiz:', error);
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
          const videoInsertResult = await insertVideo(aulaId, aulaInfo.titulo, uploadResult.url!);
          if (!videoInsertResult.success) {
            const associationError = `Erro ao associar vídeo na tabela videos: ${videoInsertResult.error || 'desconhecido'}`;
            const logId = await logUpload(userId, materiaId, fileName, fileType, 'erro', associationError, associationError, aulaId || undefined);
            return { success: false, error: associationError, logId: logId || undefined };
          }
        } else if (fileType === 'csv') {
          const csvContent = await file.text();
          const isQuizCsv = /quiz/i.test(fileName);

          if (isQuizCsv) {
            const questions = parseQuizCsv(csvContent);
            const quizInserted = await insertQuiz({
              aulaId,
              materiaId,
              titulo: aulaInfo.titulo,
              questoes: questions,
            });
            if (!quizInserted) {
              const associationError = 'Erro ao associar quiz';
              const logId = await logUpload(userId, materiaId, fileName, fileType, 'erro', associationError, associationError, aulaId || undefined);
              return { success: false, error: associationError, logId: logId || undefined };
            }
          } else {
            const cards = parseFlashcardsCsv(csvContent);
            const flashcardInserted = await insertMaterial({
              aulaId,
              materiaId,
              tipo: 'flashcard',
              titulo: aulaInfo.titulo,
              url: uploadResult.url!,
              conteudo: cards,
            });
            if (!flashcardInserted) {
              const associationError = 'Erro ao associar flashcards';
              const logId = await logUpload(userId, materiaId, fileName, fileType, 'erro', associationError, associationError, aulaId || undefined);
              return { success: false, error: associationError, logId: logId || undefined };
            }
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
            const associationError = 'Erro ao associar material na tabela materiais_estudo';
            const logId = await logUpload(userId, materiaId, fileName, fileType, 'erro', associationError, associationError, aulaId || undefined);
            return { success: false, error: associationError, logId: logId || undefined };
          }
        }
      } else {
        message += ' - Erro ao criar/buscar aula';
      }
    } else {
      // Inserir apenas como material de estudo geral
      if (fileType === 'csv') {
        const csvContent = await file.text();
        const isQuizCsv = /quiz/i.test(fileName);

        if (isQuizCsv) {
          const questions = parseQuizCsv(csvContent);
          const quizInserted = await insertQuiz({
            aulaId: null,
            materiaId,
            titulo: fileName,
            questoes: questions,
          });
          if (!quizInserted) {
            message += ' (erro ao associar quiz)';
          }
        } else {
          const cards = parseFlashcardsCsv(csvContent);
          const flashcardInserted = await insertMaterial({
            aulaId: null,
            materiaId,
            tipo: 'flashcard',
            titulo: fileName,
            url: uploadResult.url!,
            conteudo: cards,
          });
          if (!flashcardInserted) {
            message += ' (erro ao associar flashcards)';
          }
        }
      } else {
        const materialInserted = await insertMaterial({
          aulaId: null,
          materiaId,
          tipo: materialTipo,
          titulo: fileName,
          url: uploadResult.url!,
        });
        if (!materialInserted) {
          const associationError = 'Erro ao associar material';
          const logId = await logUpload(userId, materiaId, fileName, fileType, 'erro', associationError, associationError);
          return { success: false, error: associationError, logId: logId || undefined };
        }
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
