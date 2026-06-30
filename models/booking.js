
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    bookingid: String,
    trekId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Trek',
        required: true
    },
    batchCode: {
        type: String,
        required: true
    },
    orderid: String,
    eventname: String,
    customername: String,
    mobile: Number,
    email: String,
    emergencymobile: Number,
    city: String,
    pickuplocation: String,
    eventdate: {
        type: Date,
        required: true
    },
    noofpersons: Number,
    eventfee: Number,
    amount: Number,
    address: String,
    terms:
    {
        type: Boolean,
        default: false
    },
    paymentstatus: String,
    paymentid: String,
    paymentdate: Date,
    bookingdate: Date,
    paymentvia: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    bookingstatus: {
        type: String,
        default: "Pending"
    },
    refundstatus: {
        type: String,
        default: "Not Requested"
    },
    refundid: String,
    refunddate: Date,
    refundRequestedAt: Date,
    refundEligibleAmount: Number
});

module.exports = mongoose.model('booking', bookingSchema, 'bookings');