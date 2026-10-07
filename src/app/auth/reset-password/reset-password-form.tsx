'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
import { Link2Off } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useT } from '@/src/components/I18nProvider';
import { translateApiMessage, type TKey } from '@/src/lib/i18n';
import { EASE_OUT } from '@/src/lib/motion';
import AuthHeader from '@/src/components/auth/AuthHeader';
import PasswordRule from '@/src/components/auth/PasswordRule';
import { Field, FormNotice, PasswordInput, StateIcon, SubmitButton, SuccessCheck, focusFirst } from '@/src/components/auth/fields';

const MIN_PASSWORD = 8;
const REDIRECT_MS = 3000;

type Problem = { key: TKey } | { text: string };

const swap = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.16, ease: EASE_OUT } },
};

/** New password form for the link in the reset email (`token` comes from its ?token=). */
export default function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const t = useT();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: TKey, confirmPassword?: TKey }>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const redirect = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(redirect.current), []);

  // No token in the link: nothing to reset, offer a fresh link instead.
  if (!token) {
    return (
      <div>
        <StateIcon className="mb-6"><Link2Off className="h-7 w-7" strokeWidth={1.8} /></StateIcon>
        <AuthHeader title={t('verify.invalidTitle')} subtitle={t('auth.invalidToken')} />
        <Button asChild size="lg" className="w-full">
          <Link href="/auth/forgot-password">{t('auth.requestNewLink')}</Link>
        </Button>
        <p className="mt-7 text-center text-[14px] text-white/55">
          {t('auth.rememberPassword')}{' '}
          <Link href="/login" className="font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:underline">
            {t('nav.signIn')}
          </Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setProblem(null);

    // Validate passwords
    const found: typeof errors = {};
    if (password.length < MIN_PASSWORD) found.password = 'auth.passwordTooShort';
    if (password !== confirmPassword) found.confirmPassword = 'auth.passwordMismatch';
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirst(Object.keys(found));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setDone(true);
        // Clear the form fields after successful submission
        setPassword('');
        setConfirmPassword('');

        // Redirect to login page after 3 seconds
        redirect.current = setTimeout(() => {
          router.push('/login');
        }, REDIRECT_MS);
      } else {
        const message = translateApiMessage(t, data.message);
        setProblem(message ? { text: message } : { key: 'auth.genericError' });
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setProblem({ key: 'common.unexpectedError' });
    } finally {
      setIsLoading(false);
    }
  };

  const clear = (field: keyof typeof errors) => setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <m.div key="done" {...swap} role="status">
          <SuccessCheck className="mb-6" />
          <AuthHeader title={t('auth.resetDone')} subtitle={t('auth.resetSuccess')} />
          <Button asChild size="lg" className="w-full">
            <Link href="/login">{t('nav.signIn')}</Link>
          </Button>
          <p className="mt-4 text-center text-[13px] text-white/50">{t('auth.redirecting')}</p>
        </m.div>
      ) : (
        <m.div key="form" {...swap}>
          <AuthHeader title={t('auth.resetHeading')} subtitle={t('auth.resetDesc')} />
          <form onSubmit={handleSubmit} noValidate className="flex flex-col">
            <div className="space-y-4">
              <Field
                id="password"
                label={t('auth.newPassword')}
                error={errors.password && t(errors.password)}
                hint={<PasswordRule met={password.length >= MIN_PASSWORD} label={t('auth.passwordHint')} />}
              >
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    name="password"
                    autoComplete="new-password"
                    enterKeyHint="next"
                    minLength={MIN_PASSWORD}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clear('password'); }}
                    required
                    disabled={isLoading}
                  />
                )}
              </Field>
              <Field id="confirmPassword" label={t('auth.confirmPassword')} error={errors.confirmPassword && t(errors.confirmPassword)}>
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    name="confirmPassword"
                    autoComplete="new-password"
                    enterKeyHint="done"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clear('confirmPassword'); }}
                    required
                    disabled={isLoading}
                  />
                )}
              </Field>
            </div>

            <FormNotice message={problem && ('key' in problem ? t(problem.key) : problem.text)} className="pt-5" />

            <SubmitButton loading={isLoading} loadingText={t('auth.resetting')} className="mt-6 w-full">
              {t('auth.resetSubmit')}
            </SubmitButton>
          </form>

          <p className="mt-7 text-center text-[14px] text-white/55">
            {t('auth.rememberPassword')}{' '}
            <Link href="/login" className="font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:underline">
              {t('nav.signIn')}
            </Link>
          </p>
        </m.div>
      )}
    </AnimatePresence>
  );
}
