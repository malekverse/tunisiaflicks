import clientPromise from '@/src/lib/mongodb';

async function clearSessions() {
  const client = await clientPromise;
  const db = client.db();
  await db.collection('sessions').deleteMany({});
  console.log('All sessions cleared');
  process.exit(0);
}

clearSessions().catch(console.error);