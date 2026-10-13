import { MongoClient, type MongoClientOptions } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;

// On Vercel every function instance has its own pool, and the cluster takes a fixed number of
// connections (500 on Atlas's free tier). The driver's defaults (100 per pool, never closed when idle)
// let a burst of instances use them all up: Atlas then refuses new ones and every page fails with
// "no primary". Small pools that close when idle keep the total well under the cap, and a page waits
// 10 seconds for the database at most (not 30), so the pages that can do without it still render.
const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 10_000,
};

type Store = { connection: Promise<MongoClient> | null };

// In development the module is reloaded on every change: one connection for the whole server.
const store: Store = process.env.NODE_ENV === 'development'
  ? ((globalThis as { _mongoStore?: Store })._mongoStore ??= { connection: null })
  : { connection: null };

/**
 * The connected client. A failed connection is logged, never left unhandled (that would end the
 * function, with every request it was serving), and never kept: the next caller connects again.
 */
function connect(): Promise<MongoClient> {
  if (store.connection) return store.connection;
  const client = new MongoClient(uri, options);
  const attempt = client.connect();
  store.connection = attempt;
  attempt.catch((error) => {
    console.error('MongoDB: connecting failed (the next request tries again)', error);
    if (store.connection === attempt) store.connection = null;
    client.close().catch(() => {});
  });
  return attempt;
}

// Connect as soon as the server starts, as before.
connect();

// Used as a promise everywhere (`await clientPromise`, the auth adapter): each use gets the current
// connection, or a new attempt when the last one failed.
const clientPromise = {
  then: (onFulfilled, onRejected) => connect().then(onFulfilled, onRejected),
  catch: (onRejected) => connect().catch(onRejected),
  finally: (onFinally) => connect().finally(onFinally),
  [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;

export default clientPromise;
