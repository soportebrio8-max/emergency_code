"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongodb_1 = require("mongodb");
function parseArgs(argv) {
    const args = {};
    for (const part of argv.slice(2)) {
        const m = part.match(/^--([^=]+)=(.*)$/);
        if (m)
            args[m[1]] = m[2];
    }
    return args;
}
(async () => {
    const args = parseArgs(process.argv);
    const MONGO_URI = process.env.MONGO_URI;
    const DB_NAME = process.env.DB_NAME;
    const COLLECTION_NAME = process.env.SETTING_COLLECTION || 'settings';
    if (!MONGO_URI || !DB_NAME) {
        console.error('Missing MONGO_URI or DB_NAME environment variable.');
        process.exit(1);
    }
    const key = process.env.SEED_KEY || 'RATE_VALUE';
    const valueRaw = (args['value'] ?? process.env.RATE_VALUE ?? '1.0');
    const numeric = Number(valueRaw);
    const value = Number.isNaN(numeric) ? valueRaw : numeric;
    const description = (args['description'] ?? process.env.RATE_DESCRIPTION ?? 'Valor de tasa por defecto');
    const client = new mongodb_1.MongoClient(MONGO_URI, {
        serverApi: {
            version: mongodb_1.ServerApiVersion.v1,
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
        };
        const result = await collection.updateOne(filter, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
        if (result.upsertedCount && result.upsertedCount > 0) {
            console.log(`Inserted new setting '${key}' with value=`, value);
        }
        else if (result.modifiedCount && result.modifiedCount > 0) {
            console.log(`Updated setting '${key}' to value=`, value);
        }
        else {
            console.log(`No changes applied for '${key}'. Document already up-to-date.`);
        }
    }
    catch (err) {
        console.error('Seed script failed:', err);
        process.exitCode = 1;
    }
    finally {
        try {
            await client.close();
        }
        catch { }
    }
})();
