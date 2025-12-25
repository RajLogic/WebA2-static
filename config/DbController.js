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
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
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
            const isNewImageUploaded = image !== currentImage;

            await this.pool.query(query, [
                name,
                event,
                venue,
                topic,
                details,
                image,
                id
            ]);

            // Only attempt to delete local files (not blob URLs)
            if (isNewImageUploaded && currentImage) {
                if (!/^https?:\/\//i.test(currentImage) && !currentImage.startsWith('/')) {
                    const localPath = path.join('uploads', 'images', currentImage);
                    try {
                        await fs.access(localPath);
                        await fs.unlink(localPath);
                    } catch (err) {
                        // File doesn't exist or can't be deleted, ignore
                    }
                }
            }

            return true;
        } catch (error) {
            this.logError(error.message);
            return false;
        }
    }

    async delete(id) {
        try {
            // First get the image filename
            const selectQuery = 'SELECT image FROM webdevsite WHERE id=$1';
            const result = await this.pool.query(selectQuery, [id]);
            const image = result.rows[0]?.image;

            // Delete the record
            const deleteQuery = 'DELETE FROM webdevsite WHERE id=$1';
            await this.pool.query(deleteQuery, [id]);

            // Delete local file only if it's a local filename
            if (image && !/^https?:\/\//i.test(image) && !image.startsWith('/')) {
                const localPath = path.join('uploads', 'images', image);
                try {
                    await fs.access(localPath);
                    await fs.unlink(localPath);
                } catch (err) {
                    // File doesn't exist or can't be deleted, ignore
                }
            }

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
        const logDir = path.join(__dirname, '..', 'logs');
        const logPath = path.join(logDir, 'my-errors.log');
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] SQL Error: ${error}\n`;

        // Ensure logs directory exists
        try {
            if (!require('fs').existsSync(logDir)) {
                require('fs').mkdirSync(logDir, { recursive: true });
            }
        } catch (err) {
            console.error('Failed to create logs directory:', err);
        }

        fs.appendFile(logPath, logMessage).catch(err => {
            console.error('Failed to write to log file:', err);
        });

        console.error('SQL Error:', error);
    }

    async uploadImage(imagePath, uploadDirectory) {
        // Legacy helper retained for local dev
        try {
            const stats = await fs.stat(uploadDirectory);
            if (stats.isDirectory()) {
                const filename = path.basename(imagePath);
                const destination = path.join(uploadDirectory, filename);
                await fs.copyFile(imagePath, destination);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }
}

module.exports = DbController;