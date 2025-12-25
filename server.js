// server.js - Main Express server (Vercel-compatible)
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbConfig } = require('./config/config');
const DbController = require('./config/DbController');
const auth = require('./middleware/auth');
const { vercelBlobPut, vercelBlobDelete } = require('./config/vercelBlob');

const app = express();
const db = new DbController(dbConfig);

// Determine if running on Vercel
const isVercel = process.env.VERCEL || process.env.NOW_REGION;

// Use /tmp directory for uploads on Vercel, local uploads otherwise
const uploadsDir = isVercel
    ? path.join('/tmp', 'uploads', 'images')
    : path.join(__dirname, 'uploads', 'images');

// Ensure uploads directory exists (only if not on Vercel or use /tmp)
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('Created uploads directory:', uploadsDir);
    }
} catch (error) {
    console.log('Could not create uploads directory (expected on Vercel):', error.message);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/gif', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, JPG, GIF, and PNG are allowed.'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Only serve local uploads in development
if (!isVercel) {
    app.use('/uploads', express.static('uploads'));
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

app.get('/insertForm', auth.requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'insertForm.html'));
});

app.get('/modify', auth.requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'modify.html'));
});

app.get('/find', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'find.html'));
});

// Auth routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', auth.handleLogin);
app.post('/api/logout', auth.handleLogout);
app.get('/api/auth/status', auth.checkAuthStatus);

// API Routes
app.get('/api/events', async (req, res) => {
    try {
        const events = await db.query('SELECT * FROM webdevsite ORDER BY id DESC');
        res.json({ success: true, data: events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/events/:id', async (req, res) => {
    try {
        const events = await db.query('SELECT * FROM webdevsite WHERE id=$1', [req.params.id]);
        if (events.length === 0) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        res.json({ success: true, data: events[0] });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/events', auth.requireLoginJson, upload.single('image'), async (req, res) => {
    try {
        const { name, event, venue, topic, details } = req.body;
        const timestamp = new Date().toISOString();
        let imageUrl = '';

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Image file is required' });
        }

        // Always upload to Vercel Blob in production
        const targetPath = 'images/' + req.file.filename;
        const result = await vercelBlobPut(targetPath, req.file.path);

        if (result.success) {
            imageUrl = result.url;
            console.log('Image uploaded to Blob:', imageUrl);

            // Clean up temporary file
            try {
                await fs.promises.unlink(req.file.path);
            } catch (err) {
                console.log('Could not delete temp file:', err.message);
            }
        } else {
            console.error('Blob upload failed:', result.error);
            // On Vercel, we must use Blob - fail if upload fails
            if (isVercel) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to upload image to storage: ' + result.error
                });
            }
            // In development, fallback to local storage
            imageUrl = req.file.filename;
        }

        const id = await db.insertQuery(name, event, venue, topic, details, imageUrl, timestamp);
        res.json({ success: true, id });
    } catch (error) {
        console.error('Error inserting event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/events/:id', auth.requireLoginJson, upload.single('image'), async (req, res) => {
    try {
        const { name, event, venue, topic, details, current_image } = req.body;
        const id = req.params.id;
        let imageUrl = current_image;

        if (req.file) {
            // Upload new image to Blob
            const targetPath = 'images/' + req.file.filename;
            const result = await vercelBlobPut(targetPath, req.file.path);

            if (result.success) {
                imageUrl = result.url;
                console.log('New image uploaded to Blob:', imageUrl);

                // Delete old image from Blob if it exists
                if (current_image && current_image.match(/^https?:\/\//i)) {
                    await vercelBlobDelete(current_image);
                }

                // Clean up temporary file
                try {
                    await fs.promises.unlink(req.file.path);
                } catch (err) {
                    console.log('Could not delete temp file:', err.message);
                }
            } else {
                console.error('Blob upload failed:', result.error);
                if (isVercel) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to upload image to storage: ' + result.error
                    });
                }
                imageUrl = req.file.filename;
            }
        }

        await db.update(id, name, event, venue, topic, details, imageUrl, current_image);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/events/:id', auth.requireLoginJson, async (req, res) => {
    try {
        // Get the event to find the image URL
        const events = await db.query('SELECT image FROM webdevsite WHERE id=$1', [req.params.id]);

        if (events.length > 0 && events[0].image) {
            const imageUrl = events[0].image;
            // Delete from Blob if it's a Blob URL
            if (imageUrl.match(/^https?:\/\//i)) {
                await vercelBlobDelete(imageUrl);
            }
        }

        await db.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/distinct/:column', async (req, res) => {
    try {
        const validColumns = ['name', 'event', 'venue', 'topic'];
        const column = req.params.column;

        if (!validColumns.includes(column)) {
            return res.status(400).json({ success: false, error: 'Invalid column' });
        }

        const results = await db.query(`SELECT DISTINCT ${column} FROM webdevsite WHERE ${column} IS NOT NULL ORDER BY ${column}`);
        const values = results.map(row => row[column]);
        res.json({ success: true, data: values });
    } catch (error) {
        console.error('Error fetching distinct values:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { column, value } = req.query;
        const validColumns = ['name', 'event', 'venue', 'topic'];

        if (!validColumns.includes(column)) {
            return res.status(400).json({ success: false, error: 'Invalid column' });
        }

        const results = await db.query(`SELECT * FROM webdevsite WHERE ${column}=$1 ORDER BY id DESC`, [value]);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error searching events:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        environment: isVercel ? 'vercel' : 'local',
        uploadsDir,
        timestamp: new Date().toISOString()
    });
});

// Export for Vercel
module.exports = app;

// Only listen if not on Vercel
if (!isVercel) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Environment:', process.env.NODE_ENV || 'development');
        console.log('Uploads directory:', uploadsDir);
    });
}