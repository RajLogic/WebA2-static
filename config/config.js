// config.js
// NeonDB Configuration using environment variables
// Format: postgresql://username:password@host/database?sslmode=require

// Load environment variables from .env file
require('dotenv').config();

function parseConfig() {
    // Parse NeonDB connection URL if provided
    const neonUrl = process.env.DATABASE_URL;

    if (neonUrl) {
        try {
            const url = new URL(neonUrl);
            return {
                host: url.hostname,
                user: url.username,
                password: url.password,
                database: url.pathname.slice(1), // Remove leading slash
                port: url.port || 5432,
                ssl: { rejectUnauthorized: false }
            };
        } catch (error) {
            console.error('Invalid DATABASE_URL:', error.message);
        }
    }

    // Fallback to individual environment variables
    const isLocalhost = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    return {
        host: process.env.DB_HOST || (isLocalhost ? 'localhost' : ''),
        user: process.env.DB_USERNAME || (isLocalhost ? 'postgres' : ''),
        password: process.env.DB_PASSWORD || (isLocalhost ? '' : ''),
        database: process.env.DB_NAME || (isLocalhost ? 'webdevsite' : ''),
        port: process.env.DB_PORT || 5432,
        ssl: isLocalhost ? false : { rejectUnauthorized: false }
    };
}

// Vercel Blob token for remote image uploads
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

const config = parseConfig();

console.log('Database Config:', {
    host: config.host,
    user: config.user,
    database: config.database,
    port: config.port,
    ssl: !!config.ssl
});

module.exports = {
    dbConfig: config,
    BLOB_READ_WRITE_TOKEN
};