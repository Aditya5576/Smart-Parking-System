// API Configuration
const API_URL = 'https://smart-parking-system-8lqz.onrender.com/api/slots';

// State Management (Session-based as per constraints)
let totalEarnings = 0;
let recentActivity = [];

// DOM Elements
const loadSlotsBtn = document.getElementById('loadSlotsBtn');
const slotsGrid = document.getElementById('slotsGrid');
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('errorContainer');

// Stats Elements
const statTotalSlots = document.getElementById('statTotalSlots');
const statOccupiedSlots = document.getElementById('statOccupiedSlots');
const statFreeSlots = document.getElementById('statFreeSlots');
const statTotalEarnings = document.getElementById('statTotalEarnings');

// Table Element
const activityTableBody = document.getElementById('activityTableBody');

// Form Elements
const entryForm = document.getElementById('entryForm');
const vehicleNoInput = document.getElementById('vehicleNo');
const vehicleTypeSelect = document.getElementById('vehicleType');
const formMessage = document.getElementById('formMessage');

const exitForm = document.getElementById('exitForm');
const exitVehicleNoInput = document.getElementById('exitVehicleNo');
const exitFormMessage = document.getElementById('exitFormMessage');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', fetchSlots);
loadSlotsBtn.addEventListener('click', fetchSlots);

// ==========================================
// VEHICLE ENTRY LOGIC
// ==========================================
entryForm.addEventListener('submit', handleVehicleEntry);

async function handleVehicleEntry(e) {
    e.preventDefault();
    const vehicleNo = vehicleNoInput.value.trim();
    const vehicleType = vehicleTypeSelect.value;

    if (!vehicleNo || !vehicleType) {
        showFormMessage('Please enter both vehicle number and type.', 'error-msg');
        return;
    }

    try {
        const response = await fetch(API_URL.replace('/slots', '/park'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleNo, vehicleType })
        });
        const result = await response.json();

        if (result.success) {
            showFormMessage(`Success! Parked at slot: ${result.assignedSlot}`, 'success-msg');
            
            // Add to activity
            addActivity({
                action: 'ENTRY',
                vehicleNo: vehicleNo,
                slot: result.assignedSlot,
                amount: '-'
            });

            entryForm.reset();
            fetchSlots();
        } else {
            showFormMessage(result.message || 'Failed to park vehicle', 'error-msg');
        }
    } catch (error) {
        console.error('Error:', error);
        showFormMessage('Server error while parking vehicle.', 'error-msg');
    }
}

function showFormMessage(message, className) {
    formMessage.textContent = message;
    formMessage.className = className;
    formMessage.classList.remove('hidden');
    setTimeout(() => formMessage.classList.add('hidden'), 5000);
}

// ==========================================
// VEHICLE EXIT LOGIC
// ==========================================
exitForm.addEventListener('submit', handleVehicleExit);

async function handleVehicleExit(e) {
    e.preventDefault();
    const vehicleNo = exitVehicleNoInput.value.trim();

    if (!vehicleNo) {
        showExitMessage('Please enter a vehicle number.', 'error-msg');
        return;
    }

    try {
        const response = await fetch(API_URL.replace('/slots', '/exit'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleNo })
        });
        const result = await response.json();

        if (result.success) {
            // Update earnings state
            totalEarnings += result.billAmount;
            statTotalEarnings.textContent = `₹${totalEarnings}`;

            showExitMessage(`Bill Generated - ₹${result.billAmount} (${result.hoursParked} hrs)`, 'success-msg');
            
            // Add to activity
            addActivity({
                action: 'EXIT',
                vehicleNo: vehicleNo,
                slot: result.freedSlot,
                amount: `₹${result.billAmount}`
            });

            exitForm.reset();
            fetchSlots();
        } else {
            showExitMessage(result.message || 'Failed to exit vehicle', 'error-msg');
        }
    } catch (error) {
        console.error('Error:', error);
        showExitMessage('Server error while exiting vehicle.', 'error-msg');
    }
}

function showExitMessage(message, className) {
    exitFormMessage.textContent = message;
    exitFormMessage.className = className;
    exitFormMessage.classList.remove('hidden');
    setTimeout(() => exitFormMessage.classList.add('hidden'), 8000);
}

// ==========================================
// ACTIVITY TABLE LOGIC
// ==========================================
function addActivity(data) {
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    
    // Add to beginning of array
    recentActivity.unshift({
        time: timeString,
        ...data
    });

    // Keep only last 10 entries to avoid UI clutter
    if (recentActivity.length > 10) {
        recentActivity.pop();
    }

    renderActivityTable();
}

function renderActivityTable() {
    if (recentActivity.length === 0) {
        activityTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5" style="text-align: center; color: #888;">No recent activity in this session</td>
            </tr>
        `;
        return;
    }

    activityTableBody.innerHTML = '';
    recentActivity.forEach(activity => {
        const badgeClass = activity.action === 'ENTRY' ? 'action-entry' : 'action-exit';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${activity.time}</td>
            <td><span class="action-badge ${badgeClass}">${activity.action}</span></td>
            <td style="font-weight: 600;">${activity.vehicleNo}</td>
            <td>${activity.slot}</td>
            <td>${activity.amount}</td>
        `;
        activityTableBody.appendChild(row);
    });
}

// ==========================================
// FETCH & RENDER PARKING SLOTS
// ==========================================
async function fetchSlots() {
    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    slotsGrid.innerHTML = '';

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Server returned status: ${response.status}`);
        
        const result = await response.json();
        if (!result.success || !result.data) throw new Error('Invalid data format received');

        // Update Stats before rendering
        updateStats(result.data);
        
        renderSlots(result.data);
    } catch (error) {
        console.error('Fetch error:', error);
        showError(`Failed to load slots.\nError: ${error.message}`);
    } finally {
        loader.classList.add('hidden');
    }
}

function updateStats(slotsData) {
    const total = slotsData.length;
    const free = slotsData.filter(s => s.status === 'FREE').length;
    const occupied = total - free;

    statTotalSlots.textContent = total;
    statOccupiedSlots.textContent = occupied;
    statFreeSlots.textContent = free;
}

function renderSlots(slotsData) {
    if (slotsData.length === 0) {
        slotsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #888;">
                No slots found in database.
            </div>
        `;
        return;
    }

    slotsData.forEach(slot => {
        const isFree = slot.status === 'FREE';
        const statusClass = isFree ? 'status-free' : 'status-occupied';
        const displayVehicleType = slot.vehicle_type ? slot.vehicle_type : 'None';

        const cardHTML = `
            <div class="slot-card">
                <div class="slot-header">
                    <span class="slot-id">${slot.slot_id}</span>
                    <span class="status-badge ${statusClass}">${slot.status}</span>
                </div>
                <div class="slot-detail">
                    <span>Distance from Gate:</span>
                    <span class="detail-value">${slot.distance} m</span>
                </div>
                <div class="slot-detail">
                    <span>Vehicle Type:</span>
                    <span class="detail-value">${displayVehicleType}</span>
                </div>
            </div>
        `;
        slotsGrid.innerHTML += cardHTML;
    });

    // Add subtle mouse tracking for glow effect on cards
    setupMouseTracking();
}

function setupMouseTracking() {
    const cards = document.querySelectorAll('.slot-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}