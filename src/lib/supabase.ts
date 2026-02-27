import { createClient } from '@supabase/supabase-js';
import type {
  User,
  Profile,
  Materia,
  Aula,
  Video,
  MaterialEstudo,
  Quiz,
  QuizAttempt,
  VideoProgress,
  UploadLog,
  UserRole,
  MaterialTipo,
  UploadStatus,
} from './index';

const supabaseUrl = 'https://mvkyapsrzupcmoorgsfg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12a3lhcHNyenVwY21vb3Jnc2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDY0MjQsImV4cCI6MjA4NzcyMjQyNH0.OIPN-SKS8OybOgodaVajBMTa6O0mRkoZb2unVH3gtfQ';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const getOrCreateAula = async (
  materiaId: string,
  numeroAula: number,
  numeroSubaula: number,
  titulo: string
): Promise<{ data: string | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.rpc('get_or_create_aula' as any, {
      p_materia_id: materiaId,
      p_aula_numero: numeroAula,
      p_assunto_numero: numeroSubaula,
      p_titulo: titulo,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const createSignedUrl = async (
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<{ data: string | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return { data: data.signedUrl, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean; contentType?: string }
): Promise<{ data: { path: string } | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: options?.upsert ?? false,
        contentType: options?.contentType ?? file.type,
      });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const getCurrentUser = async (): Promise<{
  user: User | null;
  profile: Profile | null;
  error: Error | null;
}> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) throw authError;
    if (!user) return { user: null, profile: null, error: null };

    const { data: profileByUserId, error: profileByUserIdError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Alguns projetos usam `profiles.id = auth.users.id` em vez de `profiles.user_id`.
    // Fazemos fallback para evitar bloquear o login quando o schema difere.
    const { data: profileById, error: profileByIdError } = profileByUserId
      ? { data: null, error: null }
      : await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

    const profile = profileByUserId ?? profileById;
    const profileError = profileByUserIdError ?? profileByIdError;

    // Se não existir perfil, ainda mantemos o usuário autenticado para evitar loop de login.
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Erro ao buscar perfil do usuário:', profileError);
    }

    return {
      user: {
        id: user.id,
        email: user.email!,
        created_at: user.created_at,
      },
      profile,
      error: null,
    };
  } catch (error) {
    return { user: null, profile: null, error: error as Error };
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Usuário não encontrado');

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        created_at: data.user.created_at,
      },
      error: null,
    };
  } catch (error) {
    return { user: null, error: error as Error };
  }
};

export const signUp = async (
  email: string,
  password: string,
  nome: string
): Promise<{ user: User | null; requiresEmailConfirmation: boolean; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Erro ao criar usuário');

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      role: 'student' as UserRole,
      nome,
    } as any);

    if (profileError) throw profileError;

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        created_at: data.user.created_at,
      },
      requiresEmailConfirmation: !data.session,
      error: null,
    };
  } catch (error) {
    return { user: null, requiresEmailConfirmation: false, error: error as Error };
  }
};

export const signOut = async (): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteFile = async (
  bucket: string,
  path: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

export const listFiles = async (
  bucket: string,
  path?: string
): Promise<{ data: Array<{ name: string; id: string }> | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(path);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};
