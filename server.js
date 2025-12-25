// server.js - Main Express server
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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'images');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
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
app.use('/uploads', express.static('uploads'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
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
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/events', auth.requireLoginJson, upload.single('image'), async (req, res) => {
    try {
        const { name, event, venue, topic, details } = req.body;
        const timestamp = new Date().toISOString();
        let imageUrl = '';

        if (req.file) {
            const targetPath = 'images/' + req.file.filename;
            const result = await vercelBlobPut(targetPath, req.file.path);

            if (result.success) {
                imageUrl = result.url;
                // Delete local file after upload
                const fs = require('fs').promises;
                await fs.unlink(req.file.path).catch(() => { });
            } else {
                // Keep local file if blob upload fails
                imageUrl = req.file.filename;
            }
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
            const targetPath = 'images/' + req.file.filename;
            const result = await vercelBlobPut(targetPath, req.file.path);

            if (result.success) {
                imageUrl = result.url;
                // Delete old image if it exists
                if (current_image) {
                    await vercelBlobDelete(current_image);
                }
                // Delete local file
                const fs = require('fs').promises;
                await fs.unlink(req.file.path).catch(() => { });
            } else {
                imageUrl = req.file.filename;
            }
        }

        await db.update(id, name, event, venue, topic, details, imageUrl, current_image);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/events/:id', auth.requireLoginJson, async (req, res) => {
    try {
        await db.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
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

        const results = await db.query(`SELECT DISTINCT ${column} FROM webdevsite WHERE ${column} IS NOT NULL`);
        const values = results.map(row => row[column]);
        res.json({ success: true, data: values });
    } catch (error) {
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

        const results = await db.query(`SELECT * FROM webdevsite WHERE ${column}=$1`, [value]);
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;