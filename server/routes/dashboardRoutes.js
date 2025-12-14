const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');

// ✅ CRITICAL FIX: The "/client/:userId" route MUST come FIRST.
// If it comes after "/:userId", the server thinks "client" is a user's ID and crashes.

// ---------------------------------------------------------------------
// 1. GET CLIENT DASHBOARD DATA
// ---------------------------------------------------------------------
router.get('/client/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        
        // 1. Events Created by this Client
        const myEvents = await Booking.find({ 
            clientName: user.name, 
            isEvent: true 
        }).sort({ _id: -1 });
        
        // 2. Incoming Applications (Models who clicked 'Apply')
        const applications = await Booking.find({ 
            clientName: user.name, 
            status: 'APPLIED',
            isEvent: false 
        }).populate('modelId', 'name profileImage'); // Get Model's photo & name

        res.json({ 
            profile: user, 
            events: myEvents, 
            applications: applications 
        });
    } catch (err) {
        console.error("Error fetching client data:", err);
        res.status(500).json({ message: err.message });
    }
});

// ---------------------------------------------------------------------
// 2. GET MODEL DASHBOARD DATA (Generic /:userId comes LAST)
// ---------------------------------------------------------------------
router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        
        // 1. Personal Bookings / Applications
        const myBookings = await Booking.find({ 
            modelId: req.params.userId, 
            isEvent: false 
        }).sort({ _id: -1 });

        // 2. Public Events (Available to everyone)
        const publicEvents = await Booking.find({ 
            isEvent: true,
            modelId: null 
        }).sort({ _id: -1 });

        res.json({ 
            profile: user, 
            bookings: myBookings, 
            events: publicEvents 
        });
    } catch (err) {
        console.error("Error fetching model data:", err);
        res.status(500).json({ message: err.message });
    }
});

// ---------------------------------------------------------------------
// 3. CREATE BOOKING / EVENT
// ---------------------------------------------------------------------
router.post('/booking', async (req, res) => {
    try {
        const { clientName, jobType, date, modelId, isEvent, status } = req.body;
        
        const newBooking = await Booking.create({
            clientName, 
            jobType, 
            date,
            modelId: modelId || null, 
            status: status || 'NEW',
            isEvent: isEvent || false 
        });

        res.json(newBooking);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ---------------------------------------------------------------------
// 4. UPDATE STATUS (Approve / Decline / Accept)
// ---------------------------------------------------------------------
router.put('/booking/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id, 
            { status: status }, 
            { new: true }
        );
        res.json(updatedBooking);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ---------------------------------------------------------------------
// 5. DELETE BOOKING / EVENT
// ---------------------------------------------------------------------
router.delete('/booking/:id', async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;