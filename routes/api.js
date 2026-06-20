require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const mongoose = require('mongoose');  // MongoDB library
const User = require('../models/user');  // User collection model
const jwt = require('jsonwebtoken')

const db = process.env.MONGO_URI
const bcrypt = require('bcrypt');
const Razorpay = require('razorpay');
const crypto = require('crypto');

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

async function getConnection(dbName) {
  await mongoose.connect(db);
  console.log('Connected to mongodb');
  return mongoose.connection.useDb(dbName);
}

router.get('/trek/:dbname/:tablename', async (req, res) => {
  try {
    let dbName = req.params.dbname;
    const db = await getConnection(dbName);
    let tableName = req.params.tablename;
    const data = await db.collection(tableName).find({}).toArray();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching treks' });
  }
});

router.get('/filtertrek/:dbname/:tablename', async (req, res) => {
  try {
    let dbName = req.params.dbname;
    const db = await getConnection(dbName);
    let tableName = req.params.tablename;

    const today = new Date().toISOString().split("T")[0];

    const data = await db.collection(tableName).find({
      eventdate: {
        $elemMatch: { $gte: today }
      }
    }).toArray();
    // console.log("filetr date", data.length);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching filter treks' });
  }
});

router.get('/specialtrek/:dbname/:tablename', async (req, res) => {
  try {
    let dbName = req.params.dbname;
    const db = await getConnection(dbName);
    let tableName = req.params.tablename;

    const data = await db.collection(tableName).find({
      specialEvent: true
    }).toArray();
    // console.log("filetr date", data.length);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching special treks' });
  }
});

router.post('/login/:dbname/:collectionname', async (req, res) => {
  let userData = req.body
  let dbName = req.params.dbname;
  let collectionName = req.params.collectionname;

  if (userData.email && userData.password) {
    console.log("entered in login method");
    const db = await getConnection(dbName);
    const data = await db.collection(collectionName).findOne({ email: userData.email });

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
})

router.post('/register', async (req, res) => {

  try {
    console.log("Inside register");
    const userData = req.body;
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    userData.password = hashedPassword;
    // console.log("going to db");
    const db = await getConnection('UserAdmin');
    const checkeddata = await db.collection('Users').findOne({ email: userData.email });
    if (checkeddata) {
      console.log("user present");
      return res.status(409).json({ status: 'warning', message: 'User already exist' });
    }
    else {
      await db.collection('Users').insertOne(userData);
      console.log("data inserted");
      return res.status(200).json({ status: 'success', message: 'User Registered Successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching filter treks' });
  }
});

router.post('/booking/:dbname/:collectionname', async (req, res) => {
  try {
    console.log("Inside booking");
    const bookingData = req.body;
    let dbName = req.params.dbname;
    let collectionName = req.params.collectionname;
    if (bookingData.customername) {
      console.log("customername present");
      const db = await getConnection(dbName);
      console.log("collectionName present");

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
      await db.collection(collectionName).insertOne(bookingData);
      console.log("data inserted");
      //  return res.status(200).json({ status: '200', message: 'Booking Successfull' });

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
        order.bookingid = bookingData.bookingid;
        //console.log(JSON.stringify(order, null, 2));
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

router.post('/verifypayment/:dbname/:collectionname/:bookid', async (req, res) => {
  console.log("Inside verify");
  const bookingData = req.body;
  let dbName = req.params.dbname;
  let collectionName = req.params.collectionname;
  let bookid = req.params.bookid;

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

    const db = await getConnection(dbName);
    // console.log("collectionName present");
    const result = await db.collection(collectionName).updateOne(
      { bookingid: bookid },
      {
        $set: {
          paymentstatus: "Paid",
          paymentdate: new Date(),
          orderid: razorpay_order_id,
          paymentid: razorpay_payment_id
        }
      }
    );
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

module.exports = router;
