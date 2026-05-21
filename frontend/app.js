// Dynamic API Configuration for Local + Production Compatibility
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api/slots'
    : 'https://smart-parking-system-8lqz.onrender.com/api/slots';

// State Management
let totalEarnings = 0;
let recentActivity = JSON.parse(localStorage.getItem('smartParkingActivityV2')) || [];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Filter out activities older than 24 hours
recentActivity = recentActivity.filter(activity => (Date.now() - activity.timestamp) < ONE_DAY_MS);
localStorage.setItem('smartParkingActivityV2', JSON.stringify(recentActivity));

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
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Init] DOMContentLoaded fired, fetching slots...');
    renderActivityTable();
    fetchSlots();
});

if (loadSlotsBtn) {
    loadSlotsBtn.addEventListener('click', fetchSlots);
}

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
// VEHICLE EXIT LOGIC  (Phase 3: Razorpay Payment)
// Flow: Exit Form → Create Order → Show Modal → Razorpay Popup → Verify → Free Slot
// ==========================================
exitForm.addEventListener('submit', handleVehicleExit);

async function handleVehicleExit(e) {
    e.preventDefault();
    const vehicleNo = exitVehicleNoInput.value.trim();

    if (!vehicleNo) {
        showExitMessage('Please enter a vehicle number.', 'error-msg');
        return;
    }

    showExitMessage('Calculating bill... ⏳', 'info-msg');

    try {
        // Step 1: Call backend to create a Razorpay order.
        // The slot is NOT freed here — only after successful payment.
        console.log('[exit] Creating Razorpay order for:', vehicleNo);

        const response = await fetch(API_URL.replace('/slots', '/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleNo })
        });
        const orderData = await response.json();

        if (!orderData.success) {
            showExitMessage(orderData.message || 'Could not create payment order.', 'error-msg');
            return;
        }

        console.log('[exit] Order created:', orderData.orderId, 'Amount: ₹' + orderData.amount);

        // Step 2: Show our custom payment modal with bill details
        showPaymentModal(orderData);

    } catch (error) {
        console.error('[exit] Error:', error);
        showExitMessage('Server error. Please try again.', 'error-msg');
    }
}

// ==========================================
// PAYMENT MODAL LOGIC
// ==========================================

// Modal DOM references
const paymentModal    = document.getElementById('paymentModal');
const payVehicleNo    = document.getElementById('payVehicleNo');
const paySlot         = document.getElementById('paySlot');
const payDuration     = document.getElementById('payDuration');
const payAmount       = document.getElementById('payAmount');
const payNowBtn       = document.getElementById('payNowBtn');
const payBtnText      = document.getElementById('payBtnText');
const payBtnLoader    = document.getElementById('payBtnLoader');
const cancelPayBtn    = document.getElementById('cancelPayBtn');
const paymentStatusMsg = document.getElementById('paymentStatusMsg');

// Store current order data for reuse in retry flow
let currentOrderData = null;

function showPaymentModal(orderData) {
    // Cache order for retry
    currentOrderData = orderData;

    // Populate bill details
    payVehicleNo.textContent = orderData.vehicleNo;
    paySlot.textContent      = orderData.assignedSlot;
    payDuration.textContent  = `${orderData.hoursParked} hr${orderData.hoursParked > 1 ? 's' : ''}`;
    payAmount.textContent    = `₹${orderData.amount}`;

    // Reset modal state
    paymentStatusMsg.className = 'hidden payment-status-msg';
    paymentStatusMsg.textContent = '';
    setPayBtnLoading(false);

    // Show modal
    paymentModal.classList.remove('hidden');
    exitFormMessage.classList.add('hidden');
}

function hidePaymentModal() {
    paymentModal.classList.add('hidden');
    currentOrderData = null;
}

// Cancel button — close modal without freeing the slot
cancelPayBtn.addEventListener('click', () => {
    hidePaymentModal();
    showExitMessage('Payment cancelled. Slot is still occupied.', 'error-msg');
});

// Pay Now button — open Razorpay checkout popup
payNowBtn.addEventListener('click', () => {
    if (!currentOrderData) return;
    initiateRazorpayCheckout(currentOrderData);
});

function setPayBtnLoading(isLoading) {
    if (isLoading) {
        payBtnText.classList.add('hidden');
        payBtnLoader.classList.remove('hidden');
        payNowBtn.disabled = true;
    } else {
        payBtnText.classList.remove('hidden');
        payBtnLoader.classList.add('hidden');
        payNowBtn.disabled = false;
    }
}

function showPaymentStatus(message, type) {
    paymentStatusMsg.textContent = message;
    paymentStatusMsg.className = `payment-status-msg ${type}`;
}

function initiateRazorpayCheckout(orderData) {
    console.log('[razorpay] Opening checkout for order:', orderData.orderId);
    setPayBtnLoading(true);

    const options = {
        // Key ID from backend (safe to expose, it's public)
        key: orderData.keyId,

        // Amount in paise (backend already calculated correctly)
        amount: orderData.amount * 100,
        currency: 'INR',

        // Order ID from Razorpay (created on backend)
        order_id: orderData.orderId,

        name: 'Smart Parking System',
        description: `Parking at Slot ${orderData.assignedSlot}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3523/3523063.png',

        // ✅ PAYMENT SUCCESS HANDLER
        handler: async function (response) {
            console.log('[razorpay] Payment successful:', response);
            setPayBtnLoading(false);
            showPaymentStatus('✅ Payment received! Updating records...', 'success-msg');

            // Call backend to verify signature and free the slot
            await handlePaymentSuccess(response, orderData);
        },

        prefill: {
            name: 'Parking Customer',
            email: 'customer@smartparking.com'
        },

        theme: {
            color: '#6366f1'
        },

        // ❌ PAYMENT FAILURE / DISMISSAL HANDLER
        modal: {
            ondismiss: function () {
                console.log('[razorpay] Payment modal dismissed by user.');
                setPayBtnLoading(false);
                showPaymentStatus('Payment cancelled. You can retry anytime.', 'error-msg');
            }
        }
    };

    const rzp = new Razorpay(options);

    // Handle payment errors (card declined, bank errors etc.)
    rzp.on('payment.failed', function (response) {
        console.error('[razorpay] Payment failed:', response.error);
        setPayBtnLoading(false);
        showPaymentStatus(`❌ Payment failed: ${response.error.description}. Please retry.`, 'error-msg');
    });

    rzp.open();
}

async function handlePaymentSuccess(razorpayResponse, orderData) {
    try {
        console.log('[verify] Sending payment verification to backend...');

        const verifyResponse = await fetch(API_URL.replace('/slots', '/verify-payment'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_order_id:   razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature:  razorpayResponse.razorpay_signature,
                vehicleNo:           orderData.vehicleNo
            })
        });
        const result = await verifyResponse.json();

        if (result.success) {
            console.log('[verify] Slot freed successfully:', result.freedSlot);

            // Update earnings counter
            totalEarnings += result.billAmount;
            statTotalEarnings.textContent = `₹${totalEarnings}`;

            // Success animation on modal, then close
            showPaymentStatus(`🎉 Payment Successful! ₹${result.billAmount} received. Slot ${result.freedSlot} is now free.`, 'success-msg');

            // Log to activity table with PAYMENT SUCCESS
            addActivity({
                action: 'EXIT',
                vehicleNo: orderData.vehicleNo,
                slot: result.freedSlot,
                amount: `₹${result.billAmount} ✅`
            });

            exitForm.reset();

            // Close modal after 2.5s so user can see the success message
            setTimeout(() => {
                hidePaymentModal();
                fetchSlots();
            }, 2500);

        } else {
            console.error('[verify] Verification failed:', result.message);
            showPaymentStatus(`⚠️ Verification failed: ${result.message}`, 'error-msg');
        }

    } catch (error) {
        console.error('[verify] Network error:', error);
        showPaymentStatus('⚠️ Network error during verification. Contact support.', 'error-msg');
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
    
    if (data.action === 'ENTRY') {
        recentActivity.unshift({
            vehicleNo: data.vehicleNo,
            slot: data.slot,
            entryTime: timeString,
            exitTime: '-',
            amount: '-',
            status: 'PARKED',
            timestamp: Date.now()
        });
    } else if (data.action === 'EXIT') {
        const existing = recentActivity.find(a => a.vehicleNo === data.vehicleNo && a.status === 'PARKED');
        if (existing) {
            existing.exitTime = timeString;
            existing.amount = data.amount;
            existing.status = 'COMPLETED';
            existing.timestamp = Date.now();
        } else {
            // Fallback if entry was missed
            recentActivity.unshift({
                vehicleNo: data.vehicleNo,
                slot: data.slot,
                entryTime: 'Unknown',
                exitTime: timeString,
                amount: data.amount,
                status: 'COMPLETED',
                timestamp: Date.now()
            });
        }
    }

    // Keep only last 10 entries to avoid UI clutter
    if (recentActivity.length > 10) {
        recentActivity.pop();
    }

    localStorage.setItem('smartParkingActivityV2', JSON.stringify(recentActivity));
    renderActivityTable();
}

function renderActivityTable() {
    if (recentActivity.length === 0) {
        activityTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7" style="text-align: center; color: #888;">No recent activity (last 24 hours)</td>
            </tr>
        `;
    } else {
        activityTableBody.innerHTML = '';
        recentActivity.forEach(activity => {
            const badgeClass = activity.status === 'PARKED' ? 'action-entry' : 'action-exit';
            const actionCell = activity.status === 'PARKED'
                ? `<button class="pay-row-btn" data-vehicle="${activity.vehicleNo}">💳 Pay & Exit</button>`
                : `<span style="color: #52525b; font-size: 0.8rem;">—</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 600;">${activity.vehicleNo}</td>
                <td>${activity.slot}</td>
                <td>${activity.entryTime}</td>
                <td>${activity.exitTime}</td>
                <td>${activity.amount}</td>
                <td><span class="action-badge ${badgeClass}">${activity.status}</span></td>
                <td>${actionCell}</td>
            `;
            activityTableBody.appendChild(row);
        });
    }

    // Also update mobile card view
    renderMobileActivityCards();
}

function renderMobileActivityCards() {
    const container = document.getElementById('mobileActivityCards');
    if (!container) return;

    if (recentActivity.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; color:#888; padding:1.5rem 1rem; font-size:0.9rem;">
                No recent activity (last 24 hours)
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    recentActivity.forEach(activity => {
        const badgeClass = activity.status === 'PARKED' ? 'action-entry' : 'action-exit';
        const actionHTML = activity.status === 'PARKED'
            ? `<div class="mobile-card-actions">
                 <button class="pay-row-btn" data-vehicle="${activity.vehicleNo}">💳 Pay & Exit</button>
               </div>`
            : '';

        const card = document.createElement('div');
        card.className = 'mobile-activity-card';
        card.innerHTML = `
            <div class="mobile-card-top">
                <span class="mobile-card-vehicle">🚗 ${activity.vehicleNo}</span>
                <span class="action-badge ${badgeClass}">${activity.status}</span>
            </div>
            <div class="mobile-card-row">
                <span>Slot</span>
                <span>${activity.slot}</span>
            </div>
            <div class="mobile-card-row">
                <span>Entry</span>
                <span>${activity.entryTime}</span>
            </div>
            <div class="mobile-card-row">
                <span>Exit</span>
                <span>${activity.exitTime}</span>
            </div>
            <div class="mobile-card-row">
                <span>Amount</span>
                <span>${activity.amount}</span>
            </div>
            ${actionHTML}
        `;
        container.appendChild(card);
    });
}


// Event delegation: handle Pay & Exit button clicks anywhere in the table
activityTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.pay-row-btn');
    if (!btn) return;
    await handlePayRowBtn(btn);
});

// Event delegation: same for mobile cards
document.getElementById('mobileActivityCards')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.pay-row-btn');
    if (!btn) return;
    await handlePayRowBtn(btn);
});

async function handlePayRowBtn(btn) {
    const vehicleNo = btn.getAttribute('data-vehicle');
    if (!vehicleNo) return;

    // Disable button to prevent double-clicks
    btn.disabled = true;
    btn.textContent = '⏳ Loading...';

    try {
        console.log('[pay-row] Creating order for vehicle:', vehicleNo);
        const response = await fetch(API_URL.replace('/slots', '/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleNo })
        });
        const orderData = await response.json();

        if (!orderData.success) {
            btn.disabled = false;
            btn.textContent = '💳 Pay & Exit';
            alert(orderData.message || 'Could not create payment order.');
            return;
        }

        // Show the payment modal
        showPaymentModal(orderData);

        // Re-enable button in case user cancels
        btn.disabled = false;
        btn.textContent = '💳 Pay & Exit';

    } catch (error) {
        console.error('[pay-row] Error:', error);
        btn.disabled = false;
        btn.textContent = '💳 Pay & Exit';
        alert('Server error. Please try again.');
    }
}



// ==========================================
// FETCH & RENDER PARKING SLOTS
// ==========================================
async function fetchSlots() {
    console.log('[fetchSlots] Starting fetch from:', API_URL);
    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    if (slotsGrid) slotsGrid.innerHTML = '';

    try {
        const response = await fetch(API_URL);
        console.log('[fetchSlots] Response received. Status:', response.status);
        if (!response.ok) throw new Error(`Server returned status: ${response.status}`);
        
        const result = await response.json();
        console.log('[fetchSlots] Parsed JSON result:', result);
        
        if (!result.success || !result.data) {
            throw new Error('Invalid data format received from backend');
        }

        // Update Stats before rendering
        updateStats(result.data);
        
        // Render map slots
        renderSlots(result.data);
    } catch (error) {
        console.error('[fetchSlots] Critical Error:', error);
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
        const statusClass = isFree ? 'slot-free' : 'slot-occupied';
        const labelText = isFree ? 'FREE' : 'OCCUPIED';
        
        let centerContent = '';
        let bottomContent = '';

        if (!isFree) {
            const emoji = slot.vehicle_type === 'Car' ? '🚗' : (slot.vehicle_type === 'Bike' ? '🏍️' : '🚙');
            centerContent = `<div class="vehicle-emoji">${emoji}</div>`;
            
            // Check for persistent backend data
            if (slot.vehicle_no && slot.entry_time) {
                const entryMs = new Date(slot.entry_time).getTime();
                bottomContent = `
                    <div class="slot-timer" data-entry="${entryMs}">⏱ 00:00:00</div>
                    <div class="vehicle-no-label">${slot.vehicle_no}</div>
                `;
            } else {
                bottomContent = `<div class="slot-timer">⏱ --:--:--</div>`;
            }
        }

        const cardHTML = `
            <div class="map-slot ${statusClass}">
                <div class="slot-id-bg">${slot.slot_id}</div>
                
                <div class="slot-top">
                    <span class="slot-id">${slot.slot_id}</span>
                    <span class="slot-distance">${slot.distance}m</span>
                </div>
                
                <div class="slot-center">
                    ${centerContent}
                </div>
                
                <div class="slot-bottom">
                    <span class="slot-label">${labelText}</span>
                    ${bottomContent}
                </div>
            </div>
        `;
        slotsGrid.innerHTML += cardHTML;
    });
}

// Live Timer Update Loop
setInterval(() => {
    const timers = document.querySelectorAll('.slot-timer[data-entry]');
    const now = Date.now();
    timers.forEach(timer => {
        const entryTime = parseInt(timer.getAttribute('data-entry'));
        const diffInSeconds = Math.floor((now - entryTime) / 1000);
        
        const h = String(Math.floor(diffInSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((diffInSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(diffInSeconds % 60).padStart(2, '0');
        
        timer.textContent = `⏱ ${h}:${m}:${s}`;
    });
}, 1000);

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}