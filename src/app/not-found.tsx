import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import StatusScreen from '@/src/components/info/StatusScreen';
import { Button } from '@/src/components/ui/button';
import { getT } from '@/src/lib/i18n/server';

export default function NotFound() {
  const t = getT();
  return (
    <StatusScreen big="404" title={t('notFound.message')} text={t('notFound.hint')}>
      <Button asChild size="lg" className="px-8">
        <Link href="/"><Home aria-hidden className="h-[18px] w-[18px]" />{t('notFound.home')}</Link>
      </Button>
      <Button asChild size="lg" variant="secondary">
        <Link href="/search"><Search aria-hidden className="h-[18px] w-[18px]" />{t('nav.search')}</Link>
      </Button>
    </StatusScreen>
  );
}
