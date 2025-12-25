// nav.js - Dynamic navigation component
async function loadNav() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    // Check login status
    const response = await fetch('/api/auth/status');
    const { loggedIn } = await response.json();

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
      <li><a href="/contact">Contact</a></li>
      ${loggedIn
            ? '<li><a href="#" id="logoutBtn">Logout</a></li>'
            : '<li><a href="/login">Login</a></li>'}
    </ul>
  `;

    // Add logout handler
    if (loggedIn) {
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/';
        });
    }
}

// Load navigation on page load
document.addEventListener('DOMContentLoaded', loadNav);