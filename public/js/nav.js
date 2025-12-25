// nav.js - Dynamic navigation component with real-time updates
let currentLoginState = false;
let currentUsername = null;

async function loadNav() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    try {
        // Check login status
        const response = await fetch('/api/auth/status');
        const { loggedIn, username } = await response.json();
        currentLoginState = loggedIn;
        currentUsername = username;

        // Update body class for CSS styling
        if (loggedIn) {
            document.body.classList.add('logged-in');
        } else {
            document.body.classList.remove('logged-in');
        }

        navbar.innerHTML = `
        <a href="/">
          <div class="logo-container">
            <img src="/images/mainLogo-noBack.png" alt="logo">
            <h1>Tourism Victoria</h1>
          </div>
        </a>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/insertForm">Insert</a></li>
          <li><a href="/gallery">Gallery</a></li>
          <li><a href="/modify">Modify</a></li>
          <li><a href="/find">Find</a></li>
          <li><a href="/contact">Contact</a></li>
          ${loggedIn
                ? `<li><span class="user-info">${username || 'User'}</span></li>
                   <li><a href="#" id="logoutBtn">Logout</a></li>`
                : '<li><a href="/login">Login</a></li>'}
        </ul>
      `;

        // Add logout handler
        if (loggedIn) {
            document.getElementById('logoutBtn').addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('Are you sure you want to logout?')) {
                    return;
                }

                try {
                    const logoutResponse = await fetch('/api/logout', { method: 'POST' });
                    const result = await logoutResponse.json();

                    if (result.success) {
                        currentLoginState = false;
                        currentUsername = null;
                        // Reload nav after logout
                        await loadNav();
                        // Redirect to home if on protected page
                        if (window.location.pathname === '/insertForm' || window.location.pathname === '/modify') {
                            window.location.href = '/';
                        } else {
                            // Show a brief success message
                            showNotification('Logged out successfully', 'success');
                        }
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    showNotification('Logout failed', 'error');
                }
            });
        }
    } catch (error) {
        console.error('Error loading nav:', error);
    }
}

// Simple notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 20px;
        background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Function to refresh nav (can be called from other scripts)
async function refreshNav() {
    await loadNav();
}

// Make refreshNav available globally
window.refreshNav = refreshNav;

// Load navigation on page load
document.addEventListener('DOMContentLoaded', loadNav);