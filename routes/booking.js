require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const Booking = require('../models/booking');
const Razorpay = require('razorpay');
const { sendMail } = require('../services/emailService');
const verifyToken = require('../middlewares/auth');
const Trek = require('../models/trek');

router.post('/create-Order', async (req, res) => {
  console.log("Inside booking");
  const bookingData = req.body;
  try {
    // console.log(bookingData.trekId);
    //  prevent overbooking

    const updated = await Trek.findOneAndUpdate(
      {
        _id: bookingData.trekId,
        batches: {
          $elemMatch: {
            batchId: bookingData.batchCode,
            availableSeats: { $gte: bookingData.noOfPersons }
          }
        }
      },
      {
        $inc: {
          "batches.$.availableSeats": -bookingData.noOfPersons
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

    if (bookingData.customerName) {
      const now = new Date();
      const orderId = 'TRK' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + Date.now().toString().slice(-6);
      // console.log(orderId);

      bookingData.paymentStatus = "Pending"
      bookingData.bookingId = orderId;
      bookingData.orderId = "";
      bookingData.paymentId = "";
      bookingData.paymentDate = null
      bookingData.bookingDate = new Date();
      bookingData.paymentVia = "Razorpay";
      const formatedDate = bookingData.eventDate;
      bookingData.eventDate = new Date(formatedDate)

      // console.log("bookingData.eventDate ", bookingData.eventDate);

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
          { bookingId: bookingData.bookingId },
          {
            $set: {
              orderId: order.id
            }
          }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }
        order.bookingId = bookingData.bookingId;
        res.status(200).json(order);
      }
      catch (error) {
        console.error(error);
        await Trek.updateOne(
          {
            _id: bookingData.trekId,
            batches: {
              $elemMatch: {
                batchId: bookingData.batchCode
              }
            }
          },
          {
            $inc: {
              "batches.$.availableSeats": bookingData.noOfPersons
            }
          }
        );
        const failedData = await Booking.updateOne(
          { bookingId: bookingData.bookingId },
          {
            $set: {
              paymentStatus: "Failed"
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
      res.status(400).json({ status: '400', message: 'Invalid data' });
    }
  } catch (error) {
    console.error(error);
    await Trek.updateOne(
      {
        _id: bookingData.trekId,
        batches: {
          $elemMatch: {
            batchId: bookingData.batchCode
          }
        }
      },
      {
        $inc: {
          "batches.$.availableSeats": bookingData.noOfPersons
        }
      }
    );
    res.status(500).json({ message: 'Error while booking' });
  }
});

router.get('/mybookings', verifyToken, async (req, res) => {
  try {
    console.log("inside my booking")
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = await Booking.find({
      email: req.email,
      eventDate: { $gte: today }
    }).sort({ bookingDate: -1 });

    // console.log("booking = " ,bookings)
    res.json(bookings);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.post('/cancel-refund', verifyToken, async (req, res) => {
  try {
    console.log("inside cancel booking");
    const { bookingId } = req.body;
    const booking = await Booking.findOne({ bookingId, email: req.email });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.paymentStatus === "Refunded" || booking.paymentStatus === "Refund Initiated") {
      return res.status(400).json({
        success: false,
        message: "Booking already refunded"
      });
    }
    if (booking.bookingStatus === "Cancelled" || booking.bookingStatus === "Cancellation Requested") {
      return res.status(400).json({
        success: false,
        message: 'Booking already cancelled'
      });
    }
    if (booking.paymentStatus !== "Paid") {
      return res.status(400).json({
        success: false,
        message: "Only paid bookings can be cancelled"
      });
    }
    //
    const requestDate = new Date();
    console.log("requestDate: ", requestDate)
    console.log("booking.eventDate: ", booking.eventDate)
    const diffDays = Math.ceil(
      (new Date(booking.eventDate) - requestDate) /
      (1000 * 60 * 60 * 24)
    );
    console.log("diffDays: ", diffDays)
    let refundAmount = booking.amount;
    if (diffDays >= 5) {
      refundAmount = booking.amount;
    }
    else if (diffDays >= 2) {
      refundAmount = Math.round(booking.amount * 0.5);
    }
    else {
      refundAmount = 0;
    }
    booking.bookingStatus = "Cancellation Requested";
    booking.refundStatus = "Pending";
    booking.refundRequestedAt = requestDate;
    booking.refundEligibleAmount = refundAmount;
    await booking.save();

    const htmlContent = `
    <h2>New cancellation request received</h2>
    <p><b>Booking ID:</b> ${booking.bookingId}</p>
    <p>Customer: ${booking.customerName} </p>
    <p><b>Trek:</b> ${booking.eventName}</p>
    <p><b>Trek Date:</b> ${new Date(booking.eventDate).toDateString()}</p>
    <p><b>Amount:</b> ₹${booking.amount}</p>`;
    await sendMail(process.env.EMAIL_ID_ADMIN, "TrekOne Booking Cancellation Request", htmlContent);
    //
    res.status(200).json({
      success: true,
      message: 'Booking cancellation request submitted'
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Cancellation failed'
    });
  }
});

module.exports = router;

