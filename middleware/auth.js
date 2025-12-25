// middleware/auth.js
const AUTH_USER = process.env.LOGIN_USER || 'admin';
const AUTH_PASS = process.env.LOGIN_PASS || 'admin123';

function checkCredentials(user, pass) {
    return user === AUTH_USER && pass === AUTH_PASS;
}

function isLoggedIn(req) {
    return req.session && req.session.logged_in === true;
}

function requireLogin(req, res, next) {
    if (!isLoggedIn(req)) {
        const nextUrl = req.originalUrl || '/';
        res.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
        return;
    }
    next();
}

function requireLoginJson(req, res, next) {
    if (!isLoggedIn(req)) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
    }
    next();
}

function handleLogin(req, res) {
    const { username, password } = req.body;

    if (checkCredentials(username, password)) {
        req.session.logged_in = true;
        req.session.username = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
}

function handleLogout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.json({ success: true });
    });
}

function checkAuthStatus(req, res) {
    res.json({ loggedIn: isLoggedIn(req) });
}

module.exports = {
    checkCredentials,
    isLoggedIn,
    requireLogin,
    requireLoginJson,
    handleLogin,
    handleLogout,
    checkAuthStatus
};