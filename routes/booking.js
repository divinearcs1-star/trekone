require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const Booking = require('../models/booking');
const Razorpay = require('razorpay');
const { sendMail } = require('../services/emailService');
const verifyToken = require('../middlewares/auth');
const Trek = require('../models/trek');

router.post('/create-Order', async (req, res) => {
  try {
    console.log("Inside booking");
    const bookingData = req.body;

    //  prevent overbooking

    const updated = await Trek.findOneAndUpdate(
      {
        _id: bookingData.trekId,
        availableSeats: { $gte: bookingData.noofpersons }
      },
      {
        $inc: {
          availableSeats: -bookingData.noofpersons
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Not enough seats available"
      });
    }
    //

    if (bookingData.customername) {
      const now = new Date();
      const orderId = 'TRK' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + Date.now().toString().slice(-6);
      // console.log(orderId);

      bookingData.paymentstatus = "Pending"
      bookingData.bookingid = orderId;
      bookingData.orderid = "";
      bookingData.paymentid = "";
      bookingData.paymentdate = "";
      bookingData.bookingdate = new Date();
      bookingData.paymentvia = "Razorpay";

      const newBooking = new Booking(bookingData);
      await newBooking.save();
      console.log("booking inserted");

      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      // console.log(" key id= " + key_id);
      try {
        const amount = bookingData.amount;
        const options = {
          amount: amount * 100, // paisa
          currency: 'INR',
          receipt: 'receipt_' + Date.now()
        };
        console.log("creating order");
        const order = await razorpay.orders.create(options);

        // update order id in booking collection
        const result = await Booking.updateOne(
          { bookingid: bookingData.bookingid },
          {
            $set: {
              orderid: order.id
            }
          }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }
        order.bookingid = bookingData.bookingid;
        res.status(200).json(order);
      }
      catch (error) {
        console.error(error);
        await Trek.updateOne(
          { _id: bookingData.trekId },
          {
            $inc: {
              availableSeats: bookingData.noofpersons
            }
          }
        );
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
    else {
      res.status(501).json({ status: '501', message: 'Invalid data' });
    }
  } catch (error) {
    console.error(error);
    await Trek.updateOne(
      { _id: bookingData.trekId },
      { 
        $inc: {
          availableSeats: bookingData.noofpersons
        }
      }
    );
  res.status(500).json({ message: 'Error while booking' });
}
});

router.post('/cancel-booking', verifyToken, async (req, res) => {
  try {
    console.log("inside cancel booking");
    const { bookingid } = req.body;
    const booking = await Booking.findOne({ bookingid, email: req.email });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.paymentstatus === "Refunded") {
      return res.status(400).json({
        success: false,
        message: "Booking already refunded"
      });
    }
    if (booking.bookingstatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: 'Booking already cancelled'
      });
    }
    booking.bookingstatus = "Cancelled";
    await booking.save();

    //  update seats available
    const updated = await Trek.findOneAndUpdate(
      {
        _id: booking.trekId,
      },
      {
        $inc: {
          availableSeats: booking.noofpersons
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Not enough seats available"
      });
    }
    //

    //
    const htmlContent = `
    <h2>Booking Cancelled</h2>
    <p>Hello ${booking.customername},</p>
    <p> <b>Your trek booking for '</b> ${booking.eventname} <b>' has been cancelled successfully.</b> </p>
    <p><b>Booking ID:</b> ${booking.bookingid}</p>
    <p><b>Trek Date:</b> ${booking.eventdate}</p>
    <p>No refund has been initiated for this booking.</p>
    <br/>
    <p>Team TrekOne</p>`;
    await sendMail(booking.email, "TrekOne Booking Cancelled", htmlContent);
    //
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Cancellation failed'
    });
  }
});

router.get('/mybookings', verifyToken, async (req, res) => {
  try {
    console.log("inside my booking")
    // const email = req.params.email;
    const today = new Date().toISOString().split("T")[0];

    const bookings = await Booking.find({
      email: req.email,
      eventdate: { $gte: today }
    });

    // console.log("booking = " ,bookings)
    res.json(bookings);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;

