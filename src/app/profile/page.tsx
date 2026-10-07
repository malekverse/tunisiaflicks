// app/profile/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth'; // Import authOptions
import { redirect } from 'next/navigation';
import ProfileForm from './ProfileForm';
import UserContent from './UserContent';
import Following from './Following';
import ProfileManager from './ProfileManager';
import AccountSecurity from './AccountSecurity';
import clientPromise from '@/src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getT } from '@/src/lib/i18n/server';

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

  return (
    <div className="container lg:ms-6 mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{getT()('profile.title')}</h1>
      <ProfileForm user={user} />

      {/* Viewer profiles ("Who's watching?") */}
      <ProfileManager />

      {/* User Content Section (Favorites, Saved, Watch History) */}
      <UserContent />

      {/* Release / new-episode alerts */}
      <Following />

      {/* Password, data export, account deletion */}
      <AccountSecurity />
    </div>
  );
}