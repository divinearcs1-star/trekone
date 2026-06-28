require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const User = require('../models/user');  // User collection model
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendMail } = require('../services/emailService');

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
    // const resetLink = `http://localhost:4200/reset-password/${token}`;
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const htmlContent = `
      <h1>Team TrekOne</h1> 
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password.</p>
      <a href="${resetLink}">Click here</a>
      <p>This link will expire in 1 hour.</p>`;
    await sendMail(user.email, "Reset Password", htmlContent);
    res.json({ message: 'Reset link sent' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }
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
    user.refreshToken = null;
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