import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';

type ArgMap = Record<string, string>;

function parseArgs(argv: string[]): ArgMap {
  const args: ArgMap = {};
  for (const part of argv.slice(2)) {
    const m = part.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);

  const MONGO_URI = process.env.MONGO_URI as string | undefined;
  const DB_NAME = process.env.DB_NAME as string | undefined;
  const COLLECTION_NAME = (process.env.SETTING_COLLECTION as string | undefined) || 'settings';

  if (!MONGO_URI || !DB_NAME) {
    console.error('Missing MONGO_URI or DB_NAME environment variable.');
    process.exit(1);
  }

  const key: string = 'RATE_VALUE';
  const value: number = 100;
  const description: string = "Tasa porcentual de cambio.";
  const client = new MongoClient(MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const filter = { key };
    const doc = {
      key,
      description,
      value,
      updatedAt: new Date(),
    } as const;

    const result = await collection.updateOne(
      filter,
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    if (result.upsertedCount && result.upsertedCount > 0) {
      console.log(`Inserted new setting '${key}' with value=`, value);
    } else if (result.modifiedCount && result.modifiedCount > 0) {
      console.log(`Updated setting '${key}' to value=`, value);
    } else {
      console.log(`No changes applied for '${key}'. Document already up-to-date.`);
    }
  } catch (err) {
    console.error('Seed script failed:', err);
    process.exitCode = 1;
  } finally {
    try { await client.close(); } catch {}
  }
})();
