require('dotenv').config();
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/adminAuth');

const Booking = require('../models/booking');
const User = require('../models/user');
const Trek = require('../models/trek');
const Razorpay = require('razorpay');
const { sendMail } = require('../services/emailService');

router.get('/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const totalUsers = await User.countDocuments();
    const activeTreks = await Trek.countDocuments({ status: "Active" });

    const paidBookings = await Booking.find(
      { paymentStatus: "Paid" },
      { amount: 1 }
    );
    let totalRevenue = 0;
    paidBookings.forEach(x => {
      totalRevenue += x.amount;
    });
    const totalRefunds = await Booking.countDocuments({
      refundStatus: "Refunded"
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingTreks = await Trek.countDocuments({
      status: "Active",
      batches: {
        $elemMatch: {
          eventDate: { $gte: today }
        }
      }
    });
    res.json({
      totalBookings,
      activeTreks,
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
      .sort({ bookingDate: -1 }).limit(10);
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
    const treks = await Trek.find();
    const Data = treks.map(trek => ({
      ...trek.toObject()
    }));
    res.json(Data);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// showing request refund dashbaord on admin panel
router.get('/refunds', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const refunds = await Booking.find({
      bookingStatus: "Cancellation Requested"
    }).sort({ bookingDate: -1 });
    res.status(200).json(refunds);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching refunds"
    });
  }
});

// approve refund as per business logic
router.post('/approve-refund', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log(" inside approve refund")
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }
    if (booking.refundStatus !== "Pending" || booking.bookingStatus !== "Cancellation Requested") {
      return res.status(400).json({
        message: "Refund already processed"
      });
    }
    let refundAmount = booking?.refundEligibleAmount;
    if (refundAmount <= 0) {
      booking.bookingStatus = "Cancelled";
      booking.refundStatus = "Rejected";
      await booking.save();
      return res.status(400).json({
        message: "Refund not applicable before 48 hours"
      });
    }
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const refund = await razorpay.payments.refund(booking.paymentId, {
      amount: refundAmount * 100   // optional (paisa)
    });
    console.log("Refund initiated:", refund);
    // Update booking
    booking.bookingStatus = "Cancelled";
    booking.refundStatus = "Initiated";
    booking.paymentStatus = "Refund Initiated";
    booking.refundId = refund.id;
    booking.refundDate = new Date();
    await booking.save();

    //  upadte seats available
    const trek = await Trek.findById(booking.trekId);
    if (!trek) {
      return res.status(404).json({
        message: "Trek not found"
      });
    }
    const batch = trek.batches.find(
      b => b.batchId === booking.batchCode
    );
    if (batch.availableSeats + booking.noOfPersons <= batch.totalSeats) {
      batch.availableSeats += booking.noOfPersons;
      await trek.save();
    }
    res.status(200).json({
      success: true,
      message: 'Refund successful',
      refund
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching refunds"
    });
  }
});

router.post('/reject-refund', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log(" inside reject refund")
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }
    if (booking.refundStatus !== "Pending" || booking.bookingStatus !== "Cancellation Requested") {
      return res.status(400).json({
        message: "Refund request already processed"
      });
    }
    booking.bookingStatus = "Confirmed";
    booking.refundStatus = "Rejected";
    await booking.save();

    const htmlContent = `
            <h2>Refund Rejected</h2>
            <p>Hello ${booking.customerName},</p>
            <p>Your refund request for <b>${booking.eventName}</b> has been rejected.</p>
            <p><b>Booking ID:</b> ${booking.bookingId}</p>
            <p><b>Trek Date:</b> ${new Date(booking.eventDate).toDateString()}</p>
            <p><b>Refund Status:</b> Rejected</p>
            <p>Reason: Cancel before 48 hours.</p>
            <br/>
            <p>Thank you for choosing TrekOne.</p>
            <p><b>Team TrekOne</b></p>`;
    await sendMail(booking.email, "Refund Request Rejected", htmlContent);

    res.status(200).json({
      success: true,
      message: 'Refund Rejected'
    });
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
    const newTrek = new Trek(trekData);
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
router.get('/trek/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const trek = await Trek.findById(id);
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

// router.put('/update-trek/:id', verifyToken, verifyAdmin, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const trekData = req.body;
//     const updatedTrek = await Trek.findByIdAndUpdate(
//       id,
//       trekData,
//       { new: true }
//     );
//     res.status(200).json({
//       success: true,
//       message: "Trek updated successfully",
//       updatedTrek
//     });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating trek"
//     });
//   }
// });

router.delete('/delete-trek/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Trek.findByIdAndDelete(id);
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
      .sort({ bookingDate: -1 });
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
      paymentStatus: {
        $in: ['Paid', 'Refunded', 'Failed', 'Refund Initiated', 'Pending']
      }
    }).sort({ paymentDate: -1 });
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

// router.put('/update-seats/:id', verifyToken, verifyAdmin, async (req, res) => {
//   try {
//     const trek = await Trek.findById(req.params.id);

//     if (!trek) {
//       return res.status(404).json({
//         success: false,
//         message: "Trek not found"
//       });
//     }
//     const bookedSeats =
//       trek.totalSeats - trek.availableSeats;

//     if (req.body.totalSeats < bookedSeats) {
//       return res.status(400).json({
//         success: false,
//         message: "Total seats cannot be less than booked seats"
//       });
//     }
//     trek.totalSeats = req.body.totalSeats;
//     trek.availableSeats = req.body.totalSeats - bookedSeats;
//     await trek.save();

//     res.json({
//       success: true,
//       message: "Seats updated"
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false
//     });
//   }
// });

module.exports = router
