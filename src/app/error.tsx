"use client";

import { useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { useT } from '@/src/components/I18nProvider';

// Catches render errors inside a page so one broken component shows a retry prompt instead of
// taking the whole site down with "Application error: a client-side exception has occurred".
export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className='flex flex-col items-center justify-center gap-3 w-full py-24 text-center px-4'>
      <div className='text-5xl text-red-500 font-bold'>{t('error.oops')}</div>
      <p className='text-gray-400'>{t('error.message')}</p>
      <div className='flex gap-3 mt-2'>
        <Button onClick={() => reset()} className='bg-red-500 text-white hover:bg-red-400'>{t('error.retry')}</Button>
        <Button variant='outline' onClick={() => { window.location.href = '/'; }} className='bg-transparent'>{t('error.home')}</Button>
      </div>
    </div>
  );
}
