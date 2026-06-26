require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const User = require('../models/user');  // User collection model
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');

router.post('/login', async (req, res) => {
  let userData = req.body
  try {
    // if (!userData.email || !userData.password) {
    //   return res.status(400).json({
    //     message: 'Email and password required'
    //   });
    // }
    if (userData.email && userData.password) {
      console.log("entered in login method");
      const data = await User.findOne({ email: userData.email });
      if (data) {
        const isMatch = await bcrypt.compare(userData.password, data.password);
        if (isMatch) {
          console.log("Login Success");
          let payload = {
            email: data.email,
            role: data.role
          }
          let accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' })

          const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: '7d' });

          data.refreshToken = refreshToken;
          await data.save();

          res.status(200).send({ message: 'Login Success', accessToken, refreshToken, role: data.role });
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

router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).send("No refresh token");
    }
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(403).send("Invalid refresh token");
    }
    jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET,
      async (err, decoded) => {
        if (err) {
          return res.status(403).send("Expired refresh token");
        }
        // console.log("getting new token")
        const newAccessToken = jwt.sign(
          {
            email: user.email,
            role: user.role
          },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );
        console.log("new accesstoken: ", newAccessToken)
        const newRefreshToken = jwt.sign(
          {
            email: user.email,
            role: user.role
          },
          process.env.REFRESH_SECRET,
          { expiresIn: '7d' }
        );
        user.refreshToken = newRefreshToken;
        await user.save();

        res.json({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    await User.updateOne(
      { refreshToken },
      { $unset: { refreshToken: "" } }
    );
    res.json({
      success: true,
      message: "Logged out"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

module.exports = router;
