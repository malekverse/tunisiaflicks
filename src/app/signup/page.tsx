'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { useT } from '@/src/components/I18nProvider';
import { translateApiMessage } from '@/src/lib/i18n';
import GoogleSignInButton from '@/src/components/GoogleSignInButton';

export default function SignUpPage() {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/'); // Already logged in
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return <p className="text-gray-400 py-10">{t('common.loading')}</p>; // Show a loader while checking auth state
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (response.ok) {
        router.push('/login');
      } else {
        const data = await response.json();
        setError(translateApiMessage(t, data.message) || t('auth.signUpError'));
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError(t('common.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-[350px] bg-black border border-gray-600 shadow-lg shadow-gray-600/20">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-600">{t('auth.signUp')}</CardTitle>
            <CardDescription className="text-white/80">
              {t('auth.signUpDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name" className="text-white">
                    {t('auth.name')}
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-black border-gray-600 text-white placeholder:text-white/50 focus:border-red-600 focus:ring-red-600"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email" className="text-white">
                    {t('auth.email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-black border-gray-600 text-white placeholder:text-white/50 focus:border-red-600 focus:ring-red-600"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password" className="text-white">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-black border-gray-600 text-white placeholder:text-white/50 focus:border-red-600 focus:ring-red-600"
                  />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              <Button
                type="submit"
                className="w-full mt-4 bg-red-600 text-white hover:bg-red-700 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? t('auth.signingUp') : t('auth.signUp')}
              </Button>
            </form>
            <GoogleSignInButton />
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-white/80">
              {t('auth.haveAccount')}{' '}
              <Link href="/login" className="text-red-600 hover:underline">
                {t('auth.login')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}