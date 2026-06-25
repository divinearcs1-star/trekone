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

router.post('/login', async (req, res) => {
  let userData = req.body
  try {
    if (userData.email && userData.password) {
      console.log("entered in login method");
      const data = await User.findOne({ email: userData.email });
      if (data) {
        const isMatch = await bcrypt.compare(userData.password, data.password);
        if (data && isMatch) {
          console.log("Login Success");
          let payload = { subject: 1 }
          let token = jwt.sign(payload, 'secretKey')
          res.status(200).send({ token })
        }
        else {
          res.status(401).json({ status: '401', message: 'Invalid Password' });
        }
      }
      else {
        res.status(401).json({ status: '401', message: 'Invalid Username' });
      }
    }
    else {
      res.status(401).json({ status: '401', message: 'Invalid Credentials' });
    }
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error in login' });
  }
})

router.post('/register', async (req, res) => {

  try {
    console.log("Inside register");
    const userData = req.body;
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    userData.password = hashedPassword;
    const checkeddata = await User.findOne({ email: userData.email });
    if (checkeddata) {
      console.log("user present");
      return res.status(409).json({ status: 'warning', message: 'User already exist' });
    }
    else {
      // Create new user
      const newUser = new User({
        email: userData.email, password: hashedPassword, phone: userData.phone, city: userData.city
      });
      await newUser.save();
      console.log("data inserted");
      return res.status(200).json({ status: 'success', message: 'User Registered Successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error in registration' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    console.log("Inside forgot");
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        message: "If email exists, reset link sent"
      });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();
    console.log("reset token generated");
    const resetLink = `http://localhost:4200/reset-password/${token}`;
    await transporter.sendMail({
      to: user.email,
      subject: 'Reset Password',
      html: `
      <h1>Team TrekOne</h1> 
      <h2>Password Reset</h2>
      <p>Click on the below link(click here) to reset password</p>
      <a href="${resetLink}">Click here</a>
    `
    });

    res.json({ message: 'Reset link sent' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.APP_PASS
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).json({
        status: 'warning',
        message: 'Token invalid or expired'
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();
    res.json({
      status: 'success',
      message: 'Password Updated'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
