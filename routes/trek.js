require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const Mhtrek = require('../models/mhtrek');
const Himalayatrek = require('../models/himalayatrek');
const verifyToken = require('../middlewares/auth');

router.get('/allTrek', async (req, res) => {
  try {
    console.log("In trek");
    const data = await Mhtrek.find({});

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

    const data = await Mhtrek.find({
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

router.get('/specialTrek', verifyToken, async (req, res) => {
  try {
    console.log("In specialtrek");
    const data = await Himalayatrek.find({
      specialEvent: true
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching special treks' });
  }
});

router.get('/trek/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;

    let trek;

    if (type === "free") {
      trek = await Mhtrek.findById(id);
    } else {
      trek = await Himalayatrek.findById(id);
    }

    res.json(trek);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.put('/update-trek/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;

    let updatedTrek;

    if (type === "free") {
      updatedTrek = await Mhtrek.findByIdAndUpdate(
        id,
        req.body,
        { new: true }
      );
    } else {
      updatedTrek = await Himalayatrek.findByIdAndUpdate(
        id,
        req.body,
        { new: true }
      );
    }

    res.json({
      success: true,
      trek: updatedTrek
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.delete('/delete-trek/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;

    if (type === "free") {
      await Mhtrek.findByIdAndDelete(id);
    } else {
      await Himalayatrek.findByIdAndDelete(id);
    }

    res.json({
      success: true,
      message: "Trek deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
