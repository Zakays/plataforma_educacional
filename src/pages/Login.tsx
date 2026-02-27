import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTE_PATHS, validateEmail, validatePassword } from '@/lib/index';
import { useAuth } from '@/hooks/useAuth';
import { IMAGES } from '@/assets/images';
import { springPresets } from '@/lib/motion';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const infoMessage =
    typeof location.state === 'object' &&
    location.state !== null &&
    'message' in location.state &&
    typeof (location.state as { message?: unknown }).message === 'string'
      ? (location.state as { message: string }).message
      : null;

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email) {
      errors.email = 'Email é obrigatório';
    } else if (!validateEmail(email)) {
      errors.email = 'Email inválido';
    }

    if (!password) {
      errors.password = 'Senha é obrigatória';
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        errors.password = passwordValidation.message;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      await login(email, password);
      navigate(ROUTE_PATHS.DASHBOARD);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao fazer login. Verifique suas credenciais.'
      );
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-30">
        <img
          src={IMAGES.CLEAN_EDUCATION_4}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/70" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="relative z-10 w-full max-w-md px-4"
      >
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">
              Bem-vindo de volta
            </CardTitle>
            <CardDescription className="text-center">
              Entre com suas credenciais para acessar a plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {infoMessage && (
                <Alert>
                  <AlertDescription>{infoMessage}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-sm text-destructive">
                    {validationErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setValidationErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                {validationErrors.password && (
                  <p className="text-sm text-destructive">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-sm text-muted-foreground text-center">
              Não tem uma conta?{' '}
              <Link
                to={ROUTE_PATHS.REGISTER}
                className="text-primary hover:underline font-medium"
              >
                Registre-se
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
