
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const mhtrekSchema = new Schema({
    eventname: String,
    description: String,
    eventdate: [String],
    eventTag: String,
    eventTagline: String,
    duration: String,
    fees: Number,
    difficulty: String,
    altitude: String,
    guide: String,
    attraction: [String],
    includes: [String],
    thingstocarry: [String],
    images: String,
    imagearray: [String],
    picklocation: [String],
    departurefrom: String,
    availableSeats: Number,
    totalSeats: Number,
    trekfrom: String,
    trekroute: String,
    trektime: String,
    popular: {
        type: Boolean,
        default: false
    },
    subtitlevisible: {
        type: Boolean,
        default: false
    },
    specialEvent: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('mhtrek', mhtrekSchema, 'mhtreks');