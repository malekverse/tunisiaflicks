// app/profile/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth'; // Import authOptions
import { redirect } from 'next/navigation';
import ProfileForm from './ProfileForm';
import clientPromise from '@/src/lib/mongodb';
import { ObjectId } from 'mongodb';

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
    <div className="container lg:ml-6 mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">User Profile</h1>
      <ProfileForm user={user} />
    </div>
  );
}