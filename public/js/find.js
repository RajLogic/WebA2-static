// find.js - Search functionality for events
let allEvents = [];
let isSearchActive = false;

async function loadAllEvents() {
    const tbody = document.getElementById('resultsTable');

    try {
        const response = await fetch('/api/events');
        const { success, data } = await response.json();

        if (success && data.length > 0) {
            allEvents = data;
            displayEvents(data);
        } else {
            tbody.innerHTML = '<tr><td colspan="7">No events found.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading events:', error);
        tbody.innerHTML = '<tr><td colspan="7">Error loading events.</td></tr>';
    }
}

function displayEvents(events) {
    const tbody = document.getElementById('resultsTable');

    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No events found matching your search.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(event => {
        const imgSrc = event.image.match(/^https?:\/\//i) || event.image.startsWith('/')
            ? event.image
            : `/uploads/images/${event.image}`;

        return `
            <tr onclick="window.location.href='/details.html?id=${event.id}'" style="cursor:pointer;">
                <td>${event.id}</td>
                <td>${escapeHtml(event.name)}</td>
                <td>${escapeHtml(event.event)}</td>
                <td>${escapeHtml(event.venue)}</td>
                <td>${escapeHtml(event.topic)}</td>
                <td>${escapeHtml(event.details.substring(0, 50))}...</td>
                <td><img src='${imgSrc}' alt='Event Image' width='100'></td>
            </tr>
        `;
    }).join('');
}

async function loadDistinctValues(column) {
    const valueSelect = document.getElementById('find_value');

    try {
        const response = await fetch(`/api/distinct/${column}`);
        const { success, data } = await response.json();

        if (success && data.length > 0) {
            valueSelect.innerHTML = '<option value="">Select Value</option>' +
                data.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        } else {
            valueSelect.innerHTML = '<option value="">No values found</option>';
        }
    } catch (error) {
        console.error('Error loading values:', error);
        valueSelect.innerHTML = '<option value="">Error loading values</option>';
    }
}

async function searchEvents(column, value) {
    const tbody = document.getElementById('resultsTable');
    const title = document.getElementById('resultsTitle');
    const clearBtn = document.getElementById('clearBtn');

    try {
        const response = await fetch(`/api/search?column=${encodeURIComponent(column)}&value=${encodeURIComponent(value)}`);
        const { success, data } = await response.json();

        if (success) {
            displayEvents(data);
            title.textContent = `Search Results (${data.length} found)`;
            clearBtn.style.display = 'block';
            isSearchActive = true;
        } else {
            tbody.innerHTML = '<tr><td colspan="7">Error performing search.</td></tr>';
        }
    } catch (error) {
        console.error('Error searching:', error);
        tbody.innerHTML = '<tr><td colspan="7">Error performing search.</td></tr>';
    }
}

function clearSearch() {
    document.getElementById('find_option').value = '';
    document.getElementById('find_value').innerHTML = '<option value="">Select Value</option>';
    document.getElementById('resultsTitle').textContent = 'All Events View';
    document.getElementById('clearBtn').style.display = 'none';
    isSearchActive = false;
    loadAllEvents();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.getElementById('find_option').addEventListener('change', (e) => {
    const column = e.target.value;
    if (column) {
        loadDistinctValues(column);
    } else {
        document.getElementById('find_value').innerHTML = '<option value="">Select Value</option>';
    }
});

document.getElementById('findForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const column = document.getElementById('find_option').value;
    const value = document.getElementById('find_value').value;

    if (column && value) {
        searchEvents(column, value);
    } else {
        alert('Please select both column and value');
    }
});

document.getElementById('clearBtn').addEventListener('click', clearSearch);

// Initialize
document.addEventListener('DOMContentLoaded', loadAllEvents);