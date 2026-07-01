const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/adminAuth');

router.get('/bookings-report', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ bookingDate: -1 });

        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching report"
        });
    }
});

module.exports = router;