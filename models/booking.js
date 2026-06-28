
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    bookingid: String,
    trekId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Trek',
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
    eventdate: String,
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
    paymentdate: String,
    bookingdate: String,
    paymentvia: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    bookingstatus: {
        type: String,
        default: "Confirmed"
    },
    refundstatus: {
        type: String,
        default: "Not Requested"
    },
    refundid: String,
    refunddate: Date,
    eventimage: String,
    departurefrom: String,
    guide: String
});

module.exports = mongoose.model('booking', bookingSchema, 'bookings');