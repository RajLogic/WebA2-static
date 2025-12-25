// DbController.js
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class DbController {
    constructor(config) {
        if (!config || !config.host) {
            throw new Error('Invalid database configuration. Please check your .env file.');
        }

        this.pool = new Pool({
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            port: config.port || 5432,
            ssl: config.ssl || { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            this.logError(err.message);
        });
    }

    cleanUp(value) {
        return value ? value.trim() : '';
    }

    async insertQuery(name, event, venue, topic, details, image, timestamp) {
        const query = `
      INSERT INTO webdevsite (name, event, venue, topic, details, image, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

        try {
            const result = await this.pool.query(query, [
                name,
                event,
                venue,
                topic,
                details,
                image,
                timestamp
            ]);
            return result.rows[0].id;
        } catch (error) {
            this.logError(error.message);
            throw error;
        }
    }

    async update(id, name, event, venue, topic, details, image, currentImage) {
        const query = `
      UPDATE webdevsite 
      SET name=$1, event=$2, venue=$3, topic=$4, details=$5, image=$6
      WHERE id=$7
    `;

        try {
            await this.pool.query(query, [
                name,
                event,
                venue,
                topic,
                details,
                image,
                id
            ]);

            return true;
        } catch (error) {
            this.logError(error.message);
            return false;
        }
    }

    async delete(id) {
        try {
            // Delete the record
            const deleteQuery = 'DELETE FROM webdevsite WHERE id=$1';
            await this.pool.query(deleteQuery, [id]);

            return true;
        } catch (error) {
            this.logError(error.message);
            return false;
        }
    }

    async query(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows;
        } catch (error) {
            this.logError(error.message);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
    }

    logError(error) {
        // Log to console (Vercel captures these)
        console.error('SQL Error:', error);

        // Try to write to file system (will work locally, fail silently on Vercel)
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            const logPath = path.join(logDir, 'my-errors.log');
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] SQL Error: ${error}\n`;

            // Synchronous check to avoid promises
            const fsSync = require('fs');
            if (!fsSync.existsSync(logDir)) {
                try {
                    fsSync.mkdirSync(logDir, { recursive: true });
                } catch (err) {
                    // Ignore if can't create directory (Vercel)
                }
            }

            fs.appendFile(logPath, logMessage).catch(() => {
                // Ignore file write errors on Vercel
            });
        } catch (err) {
            // Ignore all file system errors
        }
    }
}

module.exports = DbController;