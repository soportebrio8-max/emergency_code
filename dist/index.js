"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const functions = __importStar(require("@google-cloud/functions-framework"));
// =================================================================================
// 1. Acceso a las variables de entorno configuradas durante el despliegue
// =================================================================================
const MONGO_URI = process.env.MONGO_URI; // Ahora se leerá de la variable de entorno
const DB_NAME = process.env.DB_NAME; // Ahora se leerá de la variable de entorno
const COLLECTION_NAME = 'settings'; // Este permanece hardcodeado o podría ser otra variable de entorno
let client = null;
let db = null;
let collection = null;
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
        }
        catch (pingError) {
            console.warn("MongoDB connection lost, attempting to reconnect...");
            // Si el ping falla, la conexión no está activa, intentamos reconectar
            client = null;
            db = null;
            collection = null;
        }
    }
    try {
        client = new mongodb_1.MongoClient(MONGO_URI, {
            serverApi: {
                version: mongodb_1.ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        await client.connect();
        console.log("Successfully connected to MongoDB Atlas!");
        db = client.db(DB_NAME); // Usa la variable de entorno
        collection = db.collection(COLLECTION_NAME);
    }
    catch (error) {
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
        const filter = { _id: 'emergency_status' };
        const statusDoc = await collection.findOne(filter);
        let isEmergencyActive = false;
        if (statusDoc && typeof statusDoc.isEmergencyActive === 'boolean') {
            isEmergencyActive = statusDoc.isEmergencyActive;
        }
        else {
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
    }
    catch (error) {
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
