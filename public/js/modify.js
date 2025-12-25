// modify.js - Event modification functionality
let currentEventId = null;

async function loadEvents() {
    const tableBody = document.getElementById('eventsTable');
    const eventSelect = document.getElementById('eventSelect');

    try {
        const response = await fetch('/api/events');
        const { success, data } = await response.json();

        if (success && data.length > 0) {
            // Populate table
            tableBody.innerHTML = data.map(event => {
                const imgSrc = event.image.match(/^https?:\/\//i) || event.image.startsWith('/')
                    ? event.image
                    : `/uploads/images/${event.image}`;

                return `
                    <tr>
                        <td>${event.id}</td>
                        <td>${escapeHtml(event.name)}</td>
                        <td>${escapeHtml(event.event)}</td>
                        <td>${escapeHtml(event.venue)}</td>
                        <td>${escapeHtml(event.topic)}</td>
                        <td>${escapeHtml(event.details)}</td>
                        <td><img src='${imgSrc}' alt='Image' width='100'></td>
                    </tr>
                `;
            }).join('');

            // Populate dropdown
            eventSelect.innerHTML = '<option value="">Select an event</option>' +
                data.map(event => `<option value="${event.id}">${event.id}</option>`).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="7">No records found.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading events:', error);
        tableBody.innerHTML = '<tr><td colspan="7">Error loading events.</td></tr>';
    }
}

async function loadEventForEdit(id) {
    try {
        const response = await fetch(`/api/events/${id}`);
        const { success, data } = await response.json();

        if (success) {
            document.getElementById('editId').value = data.id;
            document.getElementById('editIdDisplay').value = data.id;
            document.getElementById('editName').value = data.name;
            document.getElementById('editEvent').value = data.event;
            document.getElementById('editVenue').value = data.venue;
            document.getElementById('editTopic').value = data.topic;
            document.getElementById('editDetails').value = data.details;
            document.getElementById('currentImage').value = data.image;
            document.getElementById('editForm').style.display = 'block';
            currentEventId = id;
        }
    } catch (error) {
        console.error('Error loading event:', error);
        alert('Failed to load event');
    }
}

async function deleteEvent() {
    if (!currentEventId) return;

    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
        const response = await fetch(`/api/events/${currentEventId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Data Deleted', 'Event has been deleted successfully');
        } else {
            alert('Failed to delete event: ' + result.error);
        }
    } catch (error) {
        alert('Error deleting event: ' + error.message);
    }
}

function showSuccess(title, message) {
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successSection').style.display = 'block';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.getElementById('selectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('eventSelect').value;
    if (id) {
        loadEventForEdit(id);
    }
});

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const id = formData.get('id');

    try {
        const response = await fetch(`/api/events/${id}`, {
            method: 'PUT',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Data Updated', 'Event has been updated successfully');
        } else {
            alert('Failed to update event: ' + result.error);
        }
    } catch (error) {
        alert('Error updating event: ' + error.message);
    }
});

// Load events on page load
document.addEventListener('DOMContentLoaded', loadEvents);