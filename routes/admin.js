require('dotenv').config();
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/adminAuth');

const Booking = require('../models/booking');
const User = require('../models/user');
const Mhtrek = require('../models/mhtrek');
const Himalayatrek = require('../models/himalayatrek');

router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalMhTreks = await Mhtrek.countDocuments();
    const totalHimalayaTreks = await Himalayatrek.countDocuments();

    const paidBookings = await Booking.find({
      paymentstatus: "Paid"
    });
    let totalRevenue = 0;
    paidBookings.forEach(x => {
      totalRevenue += x.amount;
    });
    const totalRefunds = await Booking.countDocuments({
      refundstatus: "Refunded"
    });
    const today = new Date().toISOString().split("T")[0];
    const upcomingTreks = await Mhtrek.countDocuments({
      isActive: true,
      eventdate: {
        $elemMatch: { $gte: today }
      }
    });
    res.json({
      totalBookings,
      activeTreks: totalMhTreks + totalHimalayaTreks,
      totalUsers,
      totalRevenue,
      totalRefunds,
      upcomingTreks
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.get('/bookings', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ bookingdate: -1 }).limit(10);
    res.status(200).json(bookings);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
});

router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -refreshToken').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.get('/treks', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const mhTreks = await Mhtrek.find();
    const himalayaTreks = await Himalayatrek.find();
    const mhData = mhTreks.map(trek => ({
      ...trek.toObject()
    }));
    const himalayaData = himalayaTreks.map(trek => ({
      ...trek.toObject()
    }));
    const allTreks = [...mhData, ...himalayaData];
    res.json(allTreks);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.get('/refunds', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const refunds = await Booking.find({
      refundstatus: "Refunded"
    }).sort({ bookingdate: -1 });
    res.status(200).json(refunds);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching refunds"
    });
  }
});

router.post('/add-trek', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const trekData = req.body;
    let newTrek;
    if (trekData.specialEvent === true) {
      newTrek = new Himalayatrek(trekData);
    } else {
      newTrek = new Mhtrek(trekData);
    }
    await newTrek.save();
    res.status(200).json({
      success: true,
      message: "Trek added successfully"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error adding trek"
    });
  }
});

// get single trek
router.get('/trek/:id/:type', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id, type } = req.params;
    let trek;
    if (type === 'Paid') {
      trek = await Himalayatrek.findById(id);
    } else {
      trek = await Mhtrek.findById(id);
    }
    if (!trek) {
      return res.status(404).json({
        success: false,
        message: "Trek not found"
      });
    }
    res.status(200).json(trek);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching trek"
    });
  }
});

router.put('/update-trek/:id/:type', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id, type } = req.params;
    const trekData = req.body;
    let updatedTrek;
    if (type === 'Paid') {
      updatedTrek = await Himalayatrek.findByIdAndUpdate(
        id,
        trekData,
        { new: true }
      );
    } else {
      updatedTrek = await Mhtrek.findByIdAndUpdate(
        id,
        trekData,
        { new: true }
      );
    }
    res.status(200).json({
      success: true,
      message: "Trek updated successfully",
      updatedTrek
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error updating trek"
    });
  }
});

router.delete('/delete-trek/:id/:type', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id, type } = req.params;
    if (type === 'Paid') {
      await Himalayatrek.findByIdAndDelete(id);
    } else {
      await Mhtrek.findByIdAndDelete(id);
    }
    res.status(200).json({
      success: true,
      message: "Trek deleted successfully"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error deleting trek"
    });
  }
});

router.get('/allBookings', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ bookingdate: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.put('/make-admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.params.id,
      {
        role: "admin"
      }
    );
    res.status(200).json({
      success: true,
      message: "User promoted to admin"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating role"
    });
  }
});

router.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payments = await Booking.find({
      paymentstatus: {
        $in: ['Paid', 'Refunded', 'Failed', 'Pending']
      }
    }).sort({ paymentdate: -1 });
    res.status(200).json(payments);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments"
    });
  }
});

router.put('/block-user/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.params.id,
      { status: 'blocked' }
    );

    res.json({
      success: true,
      message: 'User blocked'
    });

  } catch (error) {
    res.status(500).json({
      success: false
    });
  }
});

router.put('/unblock-user/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.params.id,
      { status: 'active' }
    );

    res.json({
      success: true,
      message: 'User unblocked'
    });

  } catch (error) {
    res.status(500).json({
      success: false
    });
  }
});

router.put('/update-seats/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const trek = await Mhtrek.findById(req.params.id);

    if (!trek) {
      return res.status(404).json({
        success: false,
        message: "Trek not found"
      });
    }

    const bookedSeats =
      trek.totalSeats - trek.availableSeats;

    trek.totalSeats = req.body.totalSeats;
    trek.availableSeats =
      req.body.totalSeats - bookedSeats;

    await trek.save();

    res.json({
      success: true,
      message: "Seats updated"
    });

  } catch (error) {
    res.status(500).json({
      success: false
    });
  }
});

module.exports = router;
