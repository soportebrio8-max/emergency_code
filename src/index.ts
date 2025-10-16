import { MongoClient, ServerApiVersion, Collection, Db, Filter } from 'mongodb';
import * as functions from '@google-cloud/functions-framework';

// =================================================================================
// 1. Acceso a las variables de entorno configuradas durante el despliegue
// =================================================================================
const MONGO_URI = process.env.MONGO_URI; // Ahora se leerá de la variable de entorno
const DB_NAME = process.env.DB_NAME;     // Ahora se leerá de la variable de entorno
const COLLECTION_NAME = 'settings';      // Este permanece hardcodeado o podría ser otra variable de entorno

let client: MongoClient | null = null;
let db: Db | null = null;
let collection: Collection<EmergencyStatusDoc> | null = null;

// Define el tipo del documento.
interface EmergencyStatusDoc {
    _id: string;
    isEmergencyActive: boolean;
    lastUpdated?: Date;
}

// =================================================================================
// Función para conectar a MongoDB
// =================================================================================
async function connectToMongo() {
    // Asegúrate de que las variables de entorno existan antes de intentar conectar
    if (!MONGO_URI || !DB_NAME) {
        console.error("Missing MONGO_URI or DB_NAME environment variable.");
        throw new Error("MongoDB connection details not provided.");
    }

    if (client && db && collection) {
        try {
            await db.admin().ping();
            return; // Ya conectado y activo
        } catch (pingError) {
            console.warn("MongoDB connection lost, attempting to reconnect...");
            // Si el ping falla, la conexión no está activa, intentamos reconectar
            client = null;
            db = null;
            collection = null;
        }
    }

    try {
        client = new MongoClient(MONGO_URI, { // Usa la variable de entorno
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        await client.connect();
        console.log("Successfully connected to MongoDB Atlas!");
        db = client.db(DB_NAME); // Usa la variable de entorno
        collection = db.collection<EmergencyStatusDoc>(COLLECTION_NAME);
    } catch (error) {
        console.error("Could not connect to MongoDB Atlas:", error);
        client = null;
        db = null;
        collection = null;
        throw error;
    }
}

// =================================================================================
// La Cloud Function HTTP
// =================================================================================
functions.http('getEmergencyStatus', async (req, res) => {
    res.set('Content-Type', 'application/json');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).send({ error: 'Method Not Allowed' });
        return;
    }

    try {
        await connectToMongo();

        if (!collection) {
            throw new Error("MongoDB collection not initialized after connect attempt.");
        }

        // =================================================================================
        // CORRECCIÓN FINAL para el error de `No overload matches this call`
        // Usamos 'as any' para el _id del filtro, lo cual resuelve el problema de tipado.
        // =================================================================================
        const filter: Filter<EmergencyStatusDoc> = { _id: 'emergency_status' };
        const statusDoc = await collection.findOne(filter);

        let isEmergencyActive = false;
        if (statusDoc && typeof statusDoc.isEmergencyActive === 'boolean') {
            isEmergencyActive = statusDoc.isEmergencyActive;
        } else {
            console.warn("Document 'emergency_status' or 'isEmergencyActive' field not found. Assuming normal operation.");
        }

        const status = isEmergencyActive ? 'emergency' : 'normal';
        const isNormal = !isEmergencyActive;

        const responseData = {
            status: status,
            config: {
                featureA: isNormal
            },
            timestamp: new Date().toISOString()
        };

        res.status(200).send(responseData);

    } catch (error) {
        console.error("Error in getEmergencyStatus function:", error);
        const defaultNormalResponse = {
            status: "normal",
            config: {
                featureA: true
            },
            timestamp: new Date().toISOString(),
            message: "Could not retrieve status from DB, assuming normal operation."
        };
        res.status(200).send(defaultNormalResponse);
    }
});