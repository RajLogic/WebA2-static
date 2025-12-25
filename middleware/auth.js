// middleware/auth.js
const AUTH_USER = process.env.LOGIN_USER;
const AUTH_PASS = process.env.LOGIN_PASS;

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
        res.status(401).json({ success: false, error: 'Unauthorized. Please login.' });
        return;
    }
    next();
}

function handleLogin(req, res) {
    const { username, password } = req.body;

    if (checkCredentials(username, password)) {
        req.session.logged_in = true;
        req.session.username = username;

        // Force session save to ensure it persists
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save session'
                });
            }

            console.log('User logged in:', username, 'Session ID:', req.sessionID);
            res.json({
                success: true,
                message: 'Login successful',
                username: username
            });
        });
    } else {
        console.log('Login failed for user:', username);
        res.status(401).json({
            success: false,
            error: 'Invalid username or password'
        });
    }
}

function handleLogout(req, res) {
    const username = req.session?.username;

    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to logout'
            });
        }

        console.log('User logged out:', username);
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
}

function checkAuthStatus(req, res) {
    const loggedIn = isLoggedIn(req);
    const username = req.session?.username || null;

    res.json({
        loggedIn,
        username,
        sessionID: req.sessionID
    });
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