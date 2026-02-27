export const ROUTE_PATHS = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  MATERIA: '/materia/:id',
  AULA: '/materia/:materiaId/aula/:aulaId',
  ADMIN_UPLOAD: '/admin/upload',
  ADMIN_LOGS: '/admin/logs',
} as const;

export type UserRole = 'admin' | 'student';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface Materia {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface Aula {
  id: string;
  materia_id: string;
  numero_aula: number;
  numero_subaula: number;
  titulo: string;
  descricao?: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  aula_id: string;
  titulo: string;
  url?: string;
  url_storage?: string;
  duracao?: number;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export type MaterialTipo = 'video' | 'pdf' | 'audio' | 'mapa_mental' | 'flashcard';

export interface MaterialEstudo {
  id: string;
  aula_id: string;
  tipo: MaterialTipo;
  titulo: string;
  url?: string;
  conteudo?: any;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  aula_id: string;
  titulo: string;
  questoes: Array<{
    id: string;
    pergunta: string;
    opcoes: string[];
    resposta_correta: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  respostas: Record<string, number>;
  pontuacao: number;
  total_questoes: number;
  completed_at: string;
  created_at: string;
}

export interface VideoProgress {
  id: string;
  video_id: string;
  user_id: string;
  progresso_segundos: number;
  duracao_total: number;
  concluido: boolean;
  created_at: string;
  updated_at: string;
}

export type UploadStatus = 'pending' | 'processing' | 'sucesso' | 'erro';

export interface UploadLog {
  id: string;
  user_id: string;
  materia_id?: string;
  arquivo_nome: string;
  arquivo_tipo: string;
  status: UploadStatus;
  mensagem?: string | null;
  erro_detalhes?: string | null;
  aula_criada_id?: string | null;
  created_at: string;
  // compatibilidade com schema atual do projeto
  nome_arquivo?: string;
  tipo?: string;
  mensagem_erro?: string | null;
}

export const formatAulaTitle = (numeroAula: number, numeroSubaula: number): string => {
  return `Aula ${numeroAula}.${numeroSubaula}`;
};

export const parseAulaNumber = (titulo: string): { numeroAula: number; numeroSubaula: number } | null => {
  const match = titulo.match(/Aula\s+(\d+)\.(\d+)/i);
  if (!match) return null;
  return {
    numeroAula: parseInt(match[1], 10),
    numeroSubaula: parseInt(match[2], 10),
  };
};

export const calculateProgress = (currentSeconds: number, totalSeconds: number): number => {
  if (!totalSeconds || totalSeconds === 0) return 0;
  return Math.min(Math.round((currentSeconds / totalSeconds) * 100), 100);
};

export const isVideoComplete = (percentual: number): boolean => {
  return percentual >= 90;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) {
    return { valid: false, message: 'A senha deve ter no mínimo 6 caracteres' };
  }
  return { valid: true };
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const getMaterialTipoFromExtension = (extension: string): MaterialTipo | 'video' | null => {
  const extensionMap: Record<string, MaterialTipo | 'video'> = {
    pdf: 'pdf',
    mp3: 'audio',
    wav: 'audio',
    m4a: 'audio',
    mp4: 'video',
    webm: 'video',
    mov: 'video',
  };
  return extensionMap[extension] || null;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
