// app/profile/page.tsx: Settings. One panel per section, with a sticky section list on desktop.
// Other pages link to the anchors (/profile#profiles, /profile#following).
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth'; // Import authOptions
import { redirect } from 'next/navigation';
import ProfileForm from './ProfileForm';
import UserContent from './UserContent';
import Following from './Following';
import ProfileManager from './ProfileManager';
import AccountSecurity from './AccountSecurity';
import { PushSettingsCard } from '@/src/components/PushSettings';
import SettingsNav from '@/src/components/profile/SettingsNav';
import SettingsSection from '@/src/components/profile/SettingsSection';
import PlaybackSettings from '@/src/components/profile/PlaybackSettings';
import LanguageSettings from '@/src/components/profile/LanguageSettings';
import SocialPrivacySettings from '@/src/components/social/SocialPrivacySettings';
import DigestSettings from '@/src/components/digest/DigestSettings';
import SupporterSettings from '@/src/components/support/SupporterSettings';
import TvSessionsSetting from '@/src/components/tv/TvSessionsSetting';
import clientPromise from '@/src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getT } from '@/src/lib/i18n/server';
import { getKidsMode } from '@/src/lib/profiles';

export const generateMetadata = () => ({ title: `${getT()('nav.settings')} | TunisiaFlicks` });

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = await clientPromise;
  const userData = await client.db().collection('users').findOne({ _id: new ObjectId(session.user.id) });

  if (!userData) {
    redirect('/login'); // Redirect if user data is not found
  }

  const user = {
    name: userData.name || '',
    email: userData.email || '',
    phone: userData.phone || '',
    birthdate: userData.birthdate || '',
    image: userData.image || '',
  };
  const t = getT();
  // Kids profiles don't get the grown-up sections (privacy, email, supporter), nor their nav entries.
  const kids = await getKidsMode();

  return (
    <div className="page-top pb-10">
      <div className="page-x">
        <header>
          <h1 className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white">{t('nav.settings')}</h1>
          <p className="mt-2.5 text-[15px] text-white/55">{t('settings.subtitle')}</p>
        </header>

        <div className="mt-7 sm:mt-10 lg:grid lg:grid-cols-[224px_minmax(0,1fr)] lg:items-start lg:gap-12 xl:grid-cols-[248px_minmax(0,1fr)] xl:gap-16">
          <SettingsNav kids={kids} />

          <div className="mt-6 max-w-[880px] space-y-5 sm:space-y-6 lg:mt-0">
            <SettingsSection id="account" title={t('settings.account')} description={t('settings.accountDesc')}>
              <ProfileForm user={user} />
            </SettingsSection>

            {/* Viewer profiles ("Who's watching?") */}
            <ProfileManager />

            {/* Your page, who sees what, friend requests, blocked people (#privacy) */}
            {!kids && <SocialPrivacySettings />}

            {/* Interface language, TV mode (#display) */}
            <LanguageSettings />

            <SettingsSection id="playback" title={t('settings.playback')} description={t('settings.playbackDesc')}>
              <PlaybackSettings />
            </SettingsSection>

            {/* Push notifications on this device, then email (#email) */}
            <PushSettingsCard>{!kids && <DigestSettings />}</PushSettingsCard>

            {/* Release / new-episode alerts, with the release-email switch */}
            <Following />

            {/* Favorites, Saved, Watch History */}
            <UserContent />

            {/* Supporter status and badge (#supporter) */}
            {!kids && <SupporterSettings />}

            {/* Password and TVs signed in (#security), data export and account deletion (#data) */}
            <AccountSecurity securityExtra={<TvSessionsSetting />} />
          </div>
        </div>
      </div>
    </div>
  );
}
