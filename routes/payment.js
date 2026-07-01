require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const Booking = require('../models/booking');
const WebhookLog = require('../models/webhookLog');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendMail } = require('../services/emailService');
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/adminAuth');
const Trek = require('../models/trek');

router.post('/verifypayment', async (req, res) => {
  console.log("Inside verify");

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString()).digest('hex');

    const valid = expectedSignature === razorpay_signature;
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Signature'
      });
    }
    const result = await Booking.updateOne(
      { orderId: razorpay_order_id },
      {
        $set: {
          paymentStatus: "Paid",
          paymentDate: new Date(),
          bookingStatus: "Success",
          paymentId: razorpay_payment_id
        }
      }
    );
    // if (result.matchedCount === 0) {
    //   return res.status(404).json({ message: "Booking not found" });
    // }
    res.status(200).json({
      success: true,
      message: 'Payment Verified'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/razorpay/webhook', async (req, res) => {
  // router.post('/razorpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log("inside webhook");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');
    const receivedSignature = req.headers['x-razorpay-signature'];
    if (generatedSignature !== receivedSignature) {
      return res.status(400).send('Invalid webhook signature');
    }
    // console.log("Headers:", req.headers);
    // console.log("Body:", JSON.stringify(req.body, null, 2));
    const payload = JSON.parse(req.body.toString());

    console.log("Event:", payload.event);
    const eventId = req.headers['x-razorpay-event-id'];
    // duplicate check
    const alreadyProcessed = await WebhookLog.findOne({ eventId });
    if (alreadyProcessed) {
      console.log("Duplicate webhook ignored");
      return res.status(200).json({ message: "Already processed" });
    }
    // store event first
    await WebhookLog.create({
      eventId,
      eventType: payload.event, payload
    });

    const event = payload.event;
    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      console.log("Payment ID:", payment.id);
      console.log("Amount:", payment.amount);
      console.log("Status:", payment.status);
      await Booking.updateOne(
        { orderId: payment.order_id },
        {
          $set: {
            paymentStatus: "Paid",
            bookingStatus: "Success",
            paymentId: payment.id,
            paymentDate: new Date()
          }
        }
      );
      console.log("Payment updated from webhook");

      //  booking seat manage
      // const bookingData = await Booking.findOne({ orderId: payment.order_id });
      // await Trek.updateOne(
      //   {
      //     eventName: bookingData.eventName
      //   },
      //   {
      //     $inc: {
      //       availableSeats: -bookingData.noOfPersons
      //     }
      //   }
      // );
      // //
      //
      const booking = await Booking.findOne({
        orderId: payment.order_id
      });
      if (!booking) {
        return res.status(404).json({
          message: "Booking not found"
        });
      }
      const htmlContent = `
    <h1>Booking Confirmed 🎉</h1>
    <p>Hello ${booking.customerName},</p>
    <p>Your Trek booking for <b>${booking.eventName}</b> has been successfully confirmed.</p>
    <hr/>
    <p><b>Booking ID:</b> ${booking.bookingId}</p>
    <p><b>Order ID:</b> ${booking.orderId}</p>
    <p><b>Payment ID:</b> ${booking.paymentId}</p>
    <p><b>Trek Date:</b> ${booking.eventDate}</p>
    <p><b>Amount Paid:</b> ₹${booking.amount}</p>
    <hr/>
    <p>Please carry valid ID proof on trek day.</p>
    <p>Report 30 minutes before departure time.</p>
    <br/>
    <p>Thank you for choosing TrekOne.</p>
    <p><b>Team TrekOne</b></p>`;
      await sendMail(booking.email, "TrekOne Booking Confirmation", htmlContent);
      //
    }
    if (event === 'payment.failed') {
      const payment = payload.payload.payment.entity;

      const booking = await Booking.findOne({ orderId: payment.order_id });
      if (!booking) {
        return res.status(404).json({
          message: "Booking not found"
        });
      }
      if (booking.paymentStatus === "Failed") return;
      await Booking.updateOne(
        { orderId: payment.order_id },
        {
          $set: {
            paymentStatus: "Failed",
            bookingStatus: "Failed"
          }
        }
      );
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
      //
    }
    if (event === "refund.processed") {
      const refund = payload.payload.refund.entity;
      await Booking.updateOne(
        { paymentId: refund.payment_id },
        {
          $set: {
            paymentStatus: "Refunded",
            refundStatus : "Refunded"
          }
        }
      );
      console.log("Refund processed");
      //
      const booking = await Booking.findOne({
        paymentId: refund.payment_id
      });
      if (!booking) {
        return res.status(404).json({
          message: "Booking not found"
        });
      }
      const htmlContent = `
    <h2>Refund Completed</h2>
    <p>Hello ${booking.customerName},</p>
    <p>Your refund for <b>${booking.eventName}</b> has been successfully processed.</p>
    <p><b>Booking ID:</b> ${booking.bookingId}</p>
    <p><b>Refund ID:</b> ${refund.id}</p>
    <p><b>Refund Amount:</b> ₹${refund.amount / 100}</p>
    <p>Refund will reflect in your account within 5-7 business days.</p>
    <br/>
    <p>Thank you for choosing TrekOne.</p>
    <p><b>Team TrekOne</b></p>`;
      await sendMail(booking.email, "TrekOne Refund Completed", htmlContent);
      //
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
});

router.post('/refund/:paymentId', verifyToken, async (req, res) => {
  try {
    console.log("inside refund");
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const paymentId = req.params.paymentId;
    console.log("amount", req.body.amount);

    const booking = await Booking.findOne({ paymentId, email: req.email });
    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }
    const refund = await razorpay.payments.refund(paymentId, {
      amount: req.body.amount * 100   // optional (paisa)
    });
    console.log("Refund initiated:", refund);
    res.json({
      success: true,
      refund
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/cancel-refund', verifyToken, async (req, res) => {
  try {
    console.log("inside cancel & refund");
    const { bookingId, paymentId, amount } = req.body;
    // Find booking
    const booking = await Booking.findOne({ bookingId, email: req.email });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    // Already refunded check
    if (booking.refundStatus === "Refunded") {
      return res.status(400).json({
        success: false,
        message: 'Already refunded'
      });
    }
    if (booking.bookingStatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking already cancelled"
      });
    }
    if (booking.paymentStatus !== "Paid") {
      return res.status(400).json({
        success: false,
        message: "Refund allowed only for paid bookings"
      });
    }

    // Trek date check
    const trekDate = new Date(booking.eventDate);
    const now = new Date();

    if (trekDate <= now) {
      return res.status(400).json({
        success: false,
        message: 'Refund not allowed after trek start'
      });
    }
    // 48-hour policy check
    const diffInMs = trekDate.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 48) {
      return res.status(400).json({
        success: false,
        message: 'Refund allowed only before 48 hours'
      });
    }
    // Razorpay refund
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100   // paisa
    });
    // Update booking
    booking.bookingStatus = "Cancelled";
    booking.refundStatus = "Refunded";
    booking.paymentStatus = "Refunded";
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
    //  forgot to send mail
    const htmlContent = `
        <h2>Booking Cancelled & Refund Initiated</h2>
        <p>Hello ${booking.customerName},</p>
        <p>Your booking for <b>${booking.eventName}</b> has been cancelled successfully.</p>
        <p><b>Booking ID:</b> ${booking.bookingId}</p>
        <p><b>Trek Date:</b> ${new Date(booking.eventDate).toDateString()}</p>
        <p><b>Refund Status:</b> Initiated</p>
        <p>Your refund has been initiated and will be credited to your original payment method within 5-7 business days.</p>
        <br/>
        <p>Thank you for choosing TrekOne.</p>
        <p><b>Team TrekOne</b></p>`;
    await sendMail(booking.email, "TrekOne Booking Cancelled & Refund", htmlContent);

    res.status(200).json({
      success: true,
      message: 'Refund successful',
      refund
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Refund failed',
      error: error.message
    });
  }
});

module.exports = router;
