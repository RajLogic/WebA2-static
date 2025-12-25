// update.js - Update event functionality
async function loadEventForUpdate() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        document.getElementById('currentData').innerHTML = '<p>No event ID provided</p>';
        return;
    }

    try {
        const response = await fetch(`/api/events/${eventId}`);
        const { success, data } = await response.json();

        if (success) {
            // Display current data
            const imgSrc = data.image.match(/^https?:\/\//i) || data.image.startsWith('/')
                ? data.image
                : `/uploads/images/${data.image}`;

            document.getElementById('currentData').innerHTML = `
                <h2>Current Event Information</h2>
                <p><strong>ID:</strong> ${escapeHtml(data.id)}</p>
                <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
                <p><strong>Event:</strong> ${escapeHtml(data.event)}</p>
                <p><strong>Venue:</strong> ${escapeHtml(data.venue)}</p>
                <p><strong>Topic:</strong> ${escapeHtml(data.topic)}</p>
                <p><strong>Details:</strong> ${escapeHtml(data.details)}</p>
                <p><strong>Image:</strong><br>
                    <img src="${imgSrc}" alt="Event Image" class="event-image">
                </p>
            `;

            // Populate form
            document.getElementById('eventId').value = data.id;
            document.getElementById('name').value = data.name;
            document.getElementById('event').value = data.event;
            document.getElementById('venue').value = data.venue;
            document.getElementById('topic').value = data.topic;
            document.getElementById('details').value = data.details;
            document.getElementById('currentImage').value = data.image;
        } else {
            document.getElementById('currentData').innerHTML = '<p>Event not found</p>';
        }
    } catch (error) {
        console.error('Error loading event:', error);
        document.getElementById('currentData').innerHTML = '<p>Error loading event</p>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Form submission
document.getElementById('updateForm').addEventListener('submit', async (e) => {
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
            document.getElementById('updateContainer').style.display = 'none';
            document.getElementById('successSection').style.display = 'block';
        } else {
            alert('Failed to update event: ' + result.error);
        }
    } catch (error) {
        alert('Error updating event: ' + error.message);
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', loadEventForUpdate);