// server.js - Complete Updated Smart Parking Backend

// Load environment variables from .env file (local dev)
// On Render, these are set via the dashboard environment variables panel
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');          // Built-in Node.js module for HMAC verification
const Razorpay = require('razorpay');      // Payment gateway SDK
const { execFile } = require('child_process');
const path = require('path');
const db = require('./db');

const app = express();

/* ======================================================
   RAZORPAY INSTANCE
   Keys come from .env locally, from Render env vars in production.
   NEVER hardcode these keys!
   Initialized conditionally so server doesn't crash if keys are missing.
====================================================== */
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('[Razorpay] ✓ Initialized successfully with Key ID:', process.env.RAZORPAY_KEY_ID);
} else {
    console.warn('[Razorpay] ✗ Keys missing - payment routes will return error until env vars are set on Render.');
}

/* ======================================================
   MIDDLEWARE
====================================================== */

app.use(cors());
app.use(express.json());

/* ======================================================
   TEST ROUTE
====================================================== */

app.get('/', (req, res) => {
    res.send('Smart Parking Backend is running!');
});

/* ======================================================
   GET ALL PARKING SLOTS
====================================================== */

app.get('/api/slots', async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT 
                s.slot_id, 
                s.status, 
                s.distance, 
                s.vehicle_type,
                v.vehicle_no,
                v.entry_time
            FROM slots s
            LEFT JOIN vehicles v ON s.slot_id = v.assigned_slot AND v.exit_time IS NULL
            ORDER BY s.distance ASC
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {

        console.error('Error fetching slots:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch slots',
            error: error.message
        });
    }
});

/* ======================================================
   PARK VEHICLE
====================================================== */

app.post('/api/park', async (req, res) => {

    const { vehicleNo, vehicleType } = req.body;

    // Validation
    if (!vehicleNo || !vehicleType) {
        return res.status(400).json({
            success: false,
            message: 'Vehicle number and vehicle type are required'
        });
    }

    try {

        // 1. Fetch all FREE slots from the database
        const [freeSlots] = await db.query(`
            SELECT *
            FROM slots
            WHERE status = 'FREE'
        `);

        // Parking full
        if (freeSlots.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Parking is full'
            });
        }

        // Function to handle database updates after a slot is found
        const finalizeParking = async (bestSlotId, method) => {
            if (bestSlotId === 'NONE' || !bestSlotId) {
                return res.status(400).json({ success: false, message: 'Allocation failed.' });
            }
            try {
                // 5. Mark the chosen slot as OCCUPIED
                await db.query(`
                    UPDATE slots
                    SET status = 'OCCUPIED',
                        vehicle_type = ?
                    WHERE slot_id = ?
                `, [vehicleType, bestSlotId]);

                // 6. Insert vehicle into vehicles table
                await db.query(`
                    INSERT INTO vehicles
                    (vehicle_no, vehicle_type, assigned_slot, entry_time)
                    VALUES (?, ?, ?, NOW())
                `, [vehicleNo, vehicleType, bestSlotId]);

                // 7. Return the assigned slot to the frontend
                res.json({
                    success: true,
                    message: `Vehicle parked successfully using ${method}`,
                    assignedSlot: bestSlotId
                });
            } catch (dbError) {
                console.error('Database update error after allocation:', dbError);
                res.status(500).json({ success: false, message: 'Database error', error: dbError.message });
            }
        };

        // 2. Hybrid Allocation Strategy
        if (process.env.NODE_ENV === 'production') {
            // Node.js Fallback for Live Cloud Deployment
            let bestSlotId = null;
            let minDistance = Infinity;
            
            for (const slot of freeSlots) {
                if (slot.distance < minDistance) {
                    minDistance = slot.distance;
                    bestSlotId = slot.slot_id;
                }
            }
            await finalizeParking(bestSlotId, 'Node.js Fallback (Cloud)');

        } else {
            // C++ Min Heap Execution for Local Environment
            const args = freeSlots.map(slot => `${slot.slot_id}:${slot.distance}`);
            const enginePath = path.join(__dirname, '..', 'engine', 'allocator.exe');

            execFile(enginePath, args, async (error, stdout, stderr) => {
                if (error) {
                    console.error('C++ Engine Error:', error);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'C++ Allocation Engine failed.',
                        error: error.message 
                    });
                }
                const bestSlotId = stdout.trim();
                await finalizeParking(bestSlotId, 'C++ Min Heap (Local)');
            });
        }

    } catch (error) {

        console.error('Error fetching free slots:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to park vehicle',
            error: error.message
        });
    }
});

/* ======================================================
   EXIT VEHICLE
====================================================== */

app.post('/api/exit', async (req, res) => {

    const { vehicleNo } = req.body;

    // Validation
    if (!vehicleNo) {
        return res.status(400).json({
            success: false,
            message: 'Vehicle number is required'
        });
    }

    try {

        // Find active vehicle
        const [vehicles] = await db.query(`
            SELECT *
            FROM vehicles
            WHERE vehicle_no = ?
            AND exit_time IS NULL
        `, [vehicleNo]);

        // Vehicle not found
        if (vehicles.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found or already exited'
            });
        }

        // Selected vehicle
        const vehicle = vehicles[0];

        console.log('Vehicle Found:', vehicle);

        // Calculate parking duration
        const entryTime = new Date(vehicle.entry_time);
        const exitTime = new Date();

        // Difference in milliseconds
        const diffMs = exitTime - entryTime;

        // Convert to hours
        const hoursParked = Math.max(
            1,
            Math.ceil(diffMs / (1000 * 60 * 60))
        );

        // Billing logic
        let billAmount = 20;

        if (hoursParked > 1) {
            billAmount += (hoursParked - 1) * 10;
        }

        // Update vehicle record
        await db.query(`
            UPDATE vehicles
            SET exit_time = ?,
                bill_amount = ?
            WHERE vehicle_no = ?
            AND exit_time IS NULL
        `, [
            exitTime,
            billAmount,
            vehicleNo
        ]);

        // Free parking slot
        await db.query(`
            UPDATE slots
            SET status = 'FREE',
                vehicle_type = NULL
            WHERE slot_id = ?
        `, [
            vehicle.assigned_slot
        ]);

        // Success response
        res.json({
            success: true,
            message: 'Vehicle exited successfully',
            freedSlot: vehicle.assigned_slot,
            hoursParked: hoursParked,
            billAmount: billAmount
        });

    } catch (error) {

        console.error('Error exiting vehicle:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to process exit',
            error: error.message
        });
    }
});

/* ======================================================
   CREATE RAZORPAY ORDER
   Called by frontend when a user clicks "Process Exit & Pay"
   1. Looks up vehicle and calculates bill
   2. Creates a Razorpay order (server-side, secure)
   3. Returns order_id + amount to frontend
   NOTE: Slot is NOT freed here. Slot is freed only after payment verification.
====================================================== */

app.post('/api/create-order', async (req, res) => {
    const { vehicleNo } = req.body;

    if (!razorpay) {
        return res.status(503).json({ success: false, message: 'Payment service not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Render environment variables.' });
    }

    if (!vehicleNo) {
        return res.status(400).json({ success: false, message: 'Vehicle number is required' });
    }

    try {
        console.log('[create-order] Finding vehicle:', vehicleNo);

        // Find the active parked vehicle
        const [vehicles] = await db.query(
            'SELECT * FROM vehicles WHERE vehicle_no = ? AND exit_time IS NULL',
            [vehicleNo]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found or already exited' });
        }

        const vehicle = vehicles[0];

        // Calculate parking duration
        const entryTime = new Date(vehicle.entry_time);
        const now = new Date();
        const diffMs = now - entryTime;
        const hoursParked = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

        // Billing logic: ₹20 for first hour, ₹10 per additional hour
        let billAmount = 20;
        if (hoursParked > 1) billAmount += (hoursParked - 1) * 10;

        console.log(`[create-order] Vehicle: ${vehicleNo}, Hours: ${hoursParked}, Bill: ₹${billAmount}`);

        // Create Razorpay order
        // Amount must be in PAISE (1 INR = 100 paise)
        const order = await razorpay.orders.create({
            amount: billAmount * 100,
            currency: 'INR',
            receipt: `parking_${vehicleNo}_${Date.now()}`,
            notes: {
                vehicleNo: vehicleNo,
                assignedSlot: vehicle.assigned_slot,
                hoursParked: hoursParked
            }
        });

        console.log('[create-order] Razorpay order created:', order.id);

        res.json({
            success: true,
            orderId: order.id,
            amount: billAmount,
            hoursParked: hoursParked,
            assignedSlot: vehicle.assigned_slot,
            vehicleNo: vehicleNo,
            // Send Key ID to frontend (safe - this is not the secret)
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('[create-order] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order', error: error.message });
    }
});

/* ======================================================
   VERIFY PAYMENT & FREE SLOT
   Called after Razorpay payment succeeds in the frontend.
   1. Verifies payment signature cryptographically (HMAC SHA256)
   2. Only if signature is valid: updates DB and frees the slot
   This prevents anyone from calling this route without real payment.
====================================================== */

app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, vehicleNo } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !vehicleNo) {
        return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    try {
        console.log('[verify-payment] Verifying payment for:', vehicleNo);
        console.log('[verify-payment] Order ID:', razorpay_order_id);
        console.log('[verify-payment] Payment ID:', razorpay_payment_id);

        // --- CRYPTOGRAPHIC VERIFICATION ---
        // Razorpay signs the payment with: HMAC_SHA256(order_id + '|' + payment_id, key_secret)
        // We replicate this and compare. If they match, payment is genuine.
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn('[verify-payment] Signature mismatch! Possible fraud attempt.');
            return res.status(400).json({ success: false, message: 'Payment verification failed - invalid signature' });
        }

        console.log('[verify-payment] Signature verified successfully!');

        // --- FETCH VEHICLE ---
        const [vehicles] = await db.query(
            'SELECT * FROM vehicles WHERE vehicle_no = ? AND exit_time IS NULL',
            [vehicleNo]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        const vehicle = vehicles[0];
        const exitTime = new Date();
        const diffMs = exitTime - new Date(vehicle.entry_time);
        const hoursParked = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        let billAmount = 20;
        if (hoursParked > 1) billAmount += (hoursParked - 1) * 10;

        // --- UPDATE DATABASE ---
        // 1. Log exit time and bill on vehicle record
        await db.query(
            'UPDATE vehicles SET exit_time = ?, bill_amount = ? WHERE vehicle_no = ? AND exit_time IS NULL',
            [exitTime, billAmount, vehicleNo]
        );

        // 2. Free the parking slot
        await db.query(
            "UPDATE slots SET status = 'FREE', vehicle_type = NULL WHERE slot_id = ?",
            [vehicle.assigned_slot]
        );

        console.log(`[verify-payment] Slot ${vehicle.assigned_slot} freed successfully.`);

        res.json({
            success: true,
            message: 'Payment verified and slot freed',
            freedSlot: vehicle.assigned_slot,
            hoursParked: hoursParked,
            billAmount: billAmount,
            paymentId: razorpay_payment_id
        });

    } catch (error) {
        console.error('[verify-payment] Error:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed', error: error.message });
    }
});

/* ======================================================
   ADMIN: FIX DB SCHEMA
   Alters the Railway cloud vehicles table so vehicle_type allows NULL.
   This fixes the NOT NULL constraint causing "Database error" on parking.
   Usage: GET /api/fix-db-schema
====================================================== */

app.get('/api/fix-db-schema', async (req, res) => {
    try {
        const results = [];

        // Make vehicle_type nullable (in case it was created as NOT NULL)
        await db.query(`ALTER TABLE vehicles MODIFY COLUMN vehicle_type VARCHAR(20) DEFAULT NULL`);
        results.push('✅ vehicles.vehicle_type → nullable');

        // Drop FOREIGN KEY constraint if it exists (Railway can have issues with it)
        // We do this safely by checking first
        const [fkRows] = await db.query(`
            SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'vehicles'
              AND REFERENCED_TABLE_NAME = 'slots'
        `);

        for (const fk of fkRows) {
            await db.query(`ALTER TABLE vehicles DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
            results.push(`✅ Dropped FK: ${fk.CONSTRAINT_NAME}`);
        }

        if (fkRows.length === 0) results.push('ℹ️ No foreign keys to drop');

        res.json({ success: true, message: 'Schema fixed successfully', changes: results });
    } catch (error) {
        console.error('[fix-db-schema] Error:', error);
        res.status(500).json({ success: false, message: 'Schema fix failed', error: error.message });
    }
});

/* ======================================================
   ADMIN: FIX STALE SLOTS
   One-time cleanup route.
   Resets OCCUPIED slots that have no matching vehicle record in the vehicles table.
   This fixes orphaned slots from before the LEFT JOIN was introduced.
   Usage: GET /api/fix-stale-slots
====================================================== */

app.get('/api/fix-stale-slots', async (req, res) => {
    try {
        // Find all OCCUPIED slots that have no active vehicle record
        const [staleSlots] = await db.query(`
            SELECT s.slot_id 
            FROM slots s
            LEFT JOIN vehicles v ON s.slot_id = v.assigned_slot AND v.exit_time IS NULL
            WHERE s.status = 'OCCUPIED' AND v.vehicle_no IS NULL
        `);

        if (staleSlots.length === 0) {
            return res.json({ success: true, message: 'No stale slots found. Everything is clean!', fixed: 0 });
        }

        const staleIds = staleSlots.map(s => s.slot_id);

        // Reset them to FREE
        await db.query(`
            UPDATE slots 
            SET status = 'FREE', vehicle_type = NULL 
            WHERE slot_id IN (?)
        `, [staleIds]);

        console.log(`[fix-stale-slots] Reset ${staleIds.length} stale slots:`, staleIds);

        res.json({
            success: true,
            message: `Fixed ${staleIds.length} stale slot(s) → set back to FREE.`,
            fixedSlots: staleIds,
            fixed: staleIds.length
        });

    } catch (error) {
        console.error('[fix-stale-slots] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fix stale slots', error: error.message });
    }
});

/* ======================================================
   SERVER START
====================================================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});