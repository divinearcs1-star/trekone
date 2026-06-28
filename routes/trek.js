require('dotenv').config();
const express = require('express');
const router = express.Router();   // Create route handler
const Trek = require('../models/trek');
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/adminAuth');

router.get('/allTrek', async (req, res) => {
  try {
    console.log("In trek");
    const data = await Trek.find({});

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

    const data = await Trek.find({
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
    const data = await Trek.find({
      specialEvent: true
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching special treks' });
  }
});

router.get('/trek/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trek = await Trek.findById(id);
    if (!trek) {
      return res.status(404).json({
        success: false,
        message: "Trek not found"
      });
    }
    res.json(trek);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.put('/update-trek/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const updatedTrek = await Trek.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );
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

router.delete('/delete-trek/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await Trek.findByIdAndDelete(id);

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
