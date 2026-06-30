const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const trekSchema = new Schema({
  eventname: {
    type: String,
    required: true,
    trim: true
  },
  //
  batches: [{
    batchId: {
      type: String,   // BATCH-001
      required: true
    },
    eventDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date  
    },
    reportingTime: {
      type: String 
    },
    totalSeats: {
      type: Number,
      required: true
    },
    availableSeats: {
      type: Number,
      required: true
    },
    fees: {
      type: Number,
      required: true
    },
    discountFee: Number,
    status: {
      type: String,
      enum: ["Active", "Full", "Cancelled", "Completed"],
      default: "Active"
    }
  }],
  //
  eventTagline: String,
  eventTag: String,
  description: String,
  region: {
    type: String,   // Maharashtra, Himalaya, South India
    required: true
  },
  state: {
    type: String,
    required: true
  },
  district: String,
  category: {
    type: String,   // Fort Trek, Snow Trek, Peak Trek, Jungle Trek, Lake Trek
    required: true
  },
  trekType: {
    type: String,   // Weekend, Expedition, Backpacking
    required: true
  },
  season: [String],
  difficulty: {
    type: String,
    enum: ['Easy', 'Moderate', 'Difficult']
  },
  altitude: String,
  duration: String,
  distance: String, // trek distance
  departureFrom: String,
  trekBaseVillage: String,
  trekFrom: String,
  trekRoute: String,
  fees: {
    type: Number,
    required: true
  },
  refundPolicy: String,
  totalSeats: {
    type: Number,
  },
  guide: {
    name: String,
    contact: String,
    experience: String
  },
  images: [String],
  coverImage: String,
  videoUrl: String,
  inclusions: [String],
  exclusions: [String],
  thingsToCarry: [String],
  includes: [String],
  majorAttraction: [String],
  itinerary: [
    {
      day: Number,
      title: String,
      description: String
    }
  ],
  pickupLocation: [String],
  specialEvent: {
    type: Boolean,
    default: false
  },
  popular: {
    type: Boolean,
    default: false
  },
  subtitlevisible: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Cancelled', 'Completed', 'Hidden'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Trek', trekSchema, 'treks');