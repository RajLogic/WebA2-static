// vercelBlob.js
// Helper to upload and delete files to/from Vercel Blob via HTTP

const fs = require('fs');
const path = require('path');

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

/**
 * Upload a file to Vercel Blob storage
 * @param {string} targetPath - Target path in blob storage (e.g., 'images/myfile.jpg')
 * @param {string} localFilePath - Local file path to upload
 * @returns {Promise<{success: boolean, url: string, error: string|null}>}
 */
async function vercelBlobPut(targetPath, localFilePath) {
    const token = BLOB_READ_WRITE_TOKEN;

    if (!token) {
        return {
            success: false,
            url: '',
            error: 'No BLOB_READ_WRITE_TOKEN configured'
        };
    }

    const apiBase = 'https://api.vercel.com/v1/blob';
    const url = `${apiBase.replace(/\/$/, '')}/${targetPath.replace(/^\//, '')}`;

    try {
        // Read file as buffer
        const fileBuffer = await fs.promises.readFile(localFilePath);
        const fileSize = (await fs.promises.stat(localFilePath)).size;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileSize.toString()
            },
            body: fileBuffer
        });

        if (!response.ok) {
            const text = await response.text();
            return {
                success: false,
                url: '',
                error: `HTTP ${response.status}: ${text}`
            };
        }

        const json = await response.json();

        if (json && json.url) {
            return { success: true, url: json.url, error: null };
        }

        // Fallback if no URL in response
        return { success: true, url: url, error: null };
    } catch (error) {
        return {
            success: false,
            url: '',
            error: error.message
        };
    }
}

/**
 * Delete a file from Vercel Blob storage
 * @param {string} targetPathOrUrl - Target path or full URL to delete
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
async function vercelBlobDelete(targetPathOrUrl) {
    const token = BLOB_READ_WRITE_TOKEN;

    if (!token) {
        return {
            success: false,
            error: 'No BLOB_READ_WRITE_TOKEN configured'
        };
    }

    // Extract key from URL if full URL provided
    let key = targetPathOrUrl;

    if (/^https?:\/\//i.test(targetPathOrUrl)) {
        // Try to extract path after /v1/blob/
        const match = targetPathOrUrl.match(/\/v1\/blob\/(.+)$/);
        if (match) {
            key = match[1];
        } else {
            // Fallback: use 'images/<basename>' if path contains 'images'
            const urlPath = new URL(targetPathOrUrl).pathname;
            const basename = path.basename(urlPath);
            if (basename) {
                key = `images/${basename}`;
            }
        }
    }

    const apiBase = 'https://api.vercel.com/v1/blob';
    const url = `${apiBase.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const text = await response.text();
            return {
                success: false,
                error: `HTTP ${response.status}: ${text}`
            };
        }

        return { success: true, error: null };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    vercelBlobPut,
    vercelBlobDelete
};