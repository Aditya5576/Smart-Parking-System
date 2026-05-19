// server.js - Complete Updated Smart Parking Backend

const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const path = require('path');
const db = require('./db');

const app = express();

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
            SELECT *
            FROM slots
            ORDER BY distance ASC
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
                    (vehicle_no, assigned_slot, entry_time)
                    VALUES (?, ?, NOW())
                `, [vehicleNo, bestSlotId]);

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
   SERVER START
====================================================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});