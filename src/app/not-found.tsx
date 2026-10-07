import Link from 'next/link';
import { getT } from '@/src/lib/i18n/server';

export default function NotFound() {
  const t = getT();
  return (
    <div className='flex flex-col justify-center items-center gap-2 w-full py-24 text-center'>
      <div className='text-7xl text-red-500 font-bold'>404</div>
      <div>{t('notFound.message')}</div>
      <Link href='/' className='mt-4 text-sm text-gray-400 hover:text-white underline'>{t('notFound.home')}</Link>
    </div>
  );
}
