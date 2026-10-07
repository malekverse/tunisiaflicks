"use client";

import { useEffect } from 'react';
import { Home, RotateCw } from 'lucide-react';
import StatusScreen from '@/src/components/info/StatusScreen';
import { Button } from '@/src/components/ui/button';
import { useT } from '@/src/components/I18nProvider';
import { reportError } from '@/src/lib/report-error';

// Catches render errors inside a page so one broken component shows a retry prompt instead of
// taking the whole site down with "Application error: a client-side exception has occurred".
export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <StatusScreen big={t('error.oops')} title={t('error.message')} text={t('error.hint')}>
      <Button size="lg" className="px-8" onClick={() => reset()}>
        <RotateCw aria-hidden className="h-[18px] w-[18px]" />{t('error.retry')}
      </Button>
      {/* A full page load: whatever broke in this tree doesn't come along. */}
      <Button size="lg" variant="secondary" onClick={() => { window.location.href = '/'; }}>
        <Home aria-hidden className="h-[18px] w-[18px]" />{t('error.home')}
      </Button>
    </StatusScreen>
  );
}
