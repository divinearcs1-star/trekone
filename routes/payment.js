require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const mongoose = require('mongoose');  // MongoDB library
const User = require('../models/user');  // User collection model
const Freetrek = require('../models/freetrek');
const Paidtrek = require('../models/paidtrek');
const Booking = require('../models/booking');
const WebhookLog = require('../models/webhookLog');
const jwt = require('jsonwebtoken')

const db = process.env.MONGO_URI
const bcrypt = require('bcrypt');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendMail } = require('../services/emailService');

mongoose.connect(db)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

router.post('/booking', async (req, res) => {
  try {
    console.log("Inside booking");
    const bookingData = req.body;

    if (bookingData.customername) {
      const now = new Date();
      const orderId = 'TRK' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + Date.now().toString().slice(-6);
      // console.log(orderId);

      bookingData.paymentstatus = "pending"
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
    res.status(500).json({ message: 'Error while booking' });
  }
});

router.post('/verifypayment', async (req, res) => {
  console.log("Inside verify");
  // const bookingData = req.body;
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
      { orderid: razorpay_order_id },
      {
        $set: {
          paymentstatus: "Paid",
          paymentdate: new Date(),
          // orderid: razorpay_order_id,
          paymentid: razorpay_payment_id
        }
      }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }
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
        { orderid: payment.order_id },
        {
          $set: {
            paymentstatus: "Paid",
            paymentid: payment.id,
            paymentdate: new Date()
          }
        }
      );
      console.log("Payment updated from webhook");
      //
      const booking = await Booking.findOne({
        orderid: payment.order_id
      });
      const htmlContent = `
    <h1>Booking Confirmed 🎉</h1>
    <p>Hello ${booking.customername},</p>
    <p>Your trek booking has been successfully confirmed.</p>
    <hr/>
    <p><b>Booking ID:</b> ${booking.bookingid}</p>
    <p><b>Order ID:</b> ${booking.orderid}</p>
    <p><b>Payment ID:</b> ${booking.paymentid}</p>
    <p><b>Trek Date:</b> ${booking.eventdate}</p>
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
      await Booking.updateOne(
        { orderid: payment.order_id },
        {
          $set: {
            paymentstatus: "Failed"
          }
        }
      );
    }
    if (event === "refund.processed") {
      const refund = payload.payload.refund.entity;
      await Booking.updateOne(
        { paymentid: refund.payment_id },
        {
          $set: {
            paymentstatus: "Refunded"
          }
        }
      );
      console.log("Refund processed");
      //
      const booking = await Booking.findOne({
        paymentid: refund.payment_id
      });
      const htmlContent = `
    <h2>Refund Completed</h2>
    <p>Hello ${booking.customername},</p>
    <p>Your refund has been successfully processed.</p>
    <p><b>Booking ID:</b> ${booking.bookingid}</p>
    <p><b>Refund ID:</b> ${refund.id}</p>
    <p><b>Refund Amount:</b> ₹${refund.amount}</p>
    <p>Refund will reflect in your account within 5-7 business days.</p>
    <br/>
    <p>Team TrekOne</p>`;
      await sendMail(booking.email, "TrekOne Refund Completed", htmlContent);
      //
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
});

router.post('/refund/:paymentid', async (req, res) => {
  try {
    console.log("inside refund");
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const paymentid = req.params.paymentid;
    console.log("amount", req.body.amount);
    const refund = await razorpay.payments.refund(paymentid, {
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

router.post('/cancel-refund', async (req, res) => {
  try {
    console.log("inside cancel & refund");
    const { bookingid, paymentid, amount } = req.body;
    // Find booking
    const booking = await Booking.findOne({ bookingid });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    // Already refunded check
    if (booking.refundstatus === "Refunded") {
      return res.status(400).json({
        success: false,
        message: 'Already refunded'
      });
    }
    if (booking.paymentstatus !== "Paid") {
      return res.status(400).json({
        success: false,
        message: "Refund allowed only for paid bookings"
      });
    }

    // Trek date check
    const trekDate = new Date(booking.eventdate);
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
    const refund = await razorpay.payments.refund(paymentid, {
      amount: amount * 100   // paisa
    });
    // Update booking
    booking.bookingstatus = "Cancelled";
    booking.refundstatus = "Refunded";
    booking.paymentstatus = "Refunded";
    booking.refundid = refund.id;
    booking.refunddate = new Date();
    await booking.save();

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

router.post('/cancel-booking', async (req, res) => {
  try {
    console.log("inside cancel booking");
    const { bookingid } = req.body;
    const booking = await Booking.findOne({ bookingid });
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
    //
    const htmlContent = `
    <h2>Booking Cancelled</h2>
    <p>Hello ${booking.customername},</p>
    <p>Your trek booking has been cancelled successfully.</p>
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

module.exports = router;
