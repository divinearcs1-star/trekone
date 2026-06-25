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

mongoose.connect(db)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

function verifyToken(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(401).send('Unauthorized request')
  }
  let token = req.headers.authorization.split(' ')[1]
  if (token === 'null') {
    return res.status(401).send('Unauthorized request')
  }
  let payload = jwt.verify(token, 'secretKey')
  if (!payload) {
    return res.status(401).send('Unauthorized request')
  }
  req.userId = payload.subject
  next()
}

router.get('/trek', async (req, res) => {
  try {
    console.log("In trek");
    const data = await Freetrek.find({});
    // console.log("data = ",data[0].eventname,data[1].eventname,data[2].eventname,data[3].eventname,data[4].eventname);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching treks' });
  }
});

router.get('/filtertrek', async (req, res) => {
  try {
    console.log("In filter trek");
    const today = new Date().toISOString().split("T")[0];

    const data = await Freetrek.find({
      eventdate: {
        $elemMatch: { $gte: today }
      }
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching filter treks' });
  }
});

router.get('/specialtrek', async (req, res) => {
  try {
    console.log("In specialtrek");
    const data = await Paidtrek.find({
      specialEvent: true
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching special treks' });
  }
});

router.get('/mybookings/:email', async (req, res) => {
  try {
    console.log("inside my booking")
    const email = req.params.email;
    const today = new Date().toISOString().split("T")[0];

    const bookings = await Booking.find({
      email: email,
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
