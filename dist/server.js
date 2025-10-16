"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
// ==============================================================================
// Conexión MongoDB (reutilizable entre requests)
// ==============================================================================
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
const COLLECTION_NAME = 'settings';
let client = null;
let db = null;
let collection = null;
async function connectToMongo() {
    if (!MONGO_URI || !DB_NAME) {
        console.error('Missing MONGO_URI or DB_NAME environment variable.');
        throw new Error('MongoDB connection details not provided.');
    }
    if (client && db && collection) {
        try {
            await db.admin().ping();
            return;
        }
        catch {
            client = null;
            db = null;
            collection = null;
        }
    }
    client = new mongodb_1.MongoClient(MONGO_URI, {
        serverApi: {
            version: mongodb_1.ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
    });
    await client.connect();
    db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
}
// ==============================================================================
// Servidor Express
// ==============================================================================
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
// Middleware simple (JSON no requerido para GET)
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    next();
});
// Endpoint encubierto: /rate-value (no protegido)
app.get('/rate-value', async (req, res) => {
    res.set('Content-Type', 'application/json');
    try {
        await connectToMongo();
        if (!collection)
            throw new Error('MongoDB collection not initialized after connect attempt.');
        const filter = { key: 'RATE_VALUE' };
        const doc = await collection.findOne(filter);
        if (!doc || typeof doc.value === 'undefined') {
            // Respuesta por defecto si no existe el valor
            res.status(200).send({ key: 'RATE_VALUE', value: 1.0, source: 'default', timestamp: new Date().toISOString() });
            return;
        }
        res.status(200).send({ key: 'RATE_VALUE', value: doc.value, description: doc.description, timestamp: new Date().toISOString() });
    }
    catch (error) {
        console.error('Error in /rate-value:', error);
        // Fallback seguro sin exponer errores internos
        res.status(200).send({ key: 'RATE_VALUE', value: 1.0, source: 'error-fallback', timestamp: new Date().toISOString() });
    }
});
// Healthcheck básico
app.get('/health', async (_req, res) => {
    try {
        await connectToMongo();
        res.status(200).send({ status: 'ok' });
    }
    catch (e) {
        res.status(503).send({ status: 'unhealthy' });
    }
});
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
