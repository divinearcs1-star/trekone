require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const Freetrek = require('../models/freetrek');
const Paidtrek = require('../models/paidtrek');
const verifyToken = require('../middlewares/auth');

router.get('/allTrek', async (req, res) => {
  try {
    console.log("In trek");
    const data = await Freetrek.find({});
    
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching treks' });
  }
});

router.get('/filterTrek', async (req, res) => {
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

router.get('/specialTrek', verifyToken , async (req, res) => {
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

module.exports = router;
