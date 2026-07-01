
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    bookingId: {
        type: String,
        required: true
    },
    trekId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Trek',
        required: true
    },
    batchCode: {
        type: String,
        required: true
    },
    orderId: String,
    eventName: {
        type: String,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    mobile: String,
    email: {
        type: String,
        required: true
    },
    emergencyMobile: String,
    city: String,
    pickupLocation: String,
    eventDate: {
        type: Date,
        required: true
    },
    noOfPersons: Number,
    eventFee: Number,
    amount: {
        type: Number,
        required: true
    },
    address: String,
    terms:
    {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: [
            "Pending",
            "Paid",
            "Failed",
            "Refund Pending",
            "Refund Initiated",
            "Refunded"
        ],
        default: "Pending"
    },
    paymentId: String,
    paymentDate: Date,
    bookingDate: Date,
    paymentVia: String,
    bookingStatus: {
        type: String,
        enum: [
            "Pending",
            "Success",
            "Failed",
            "Confirmed",
            "Cancellation Requested",
            "Cancelled"
        ],
        default: "Pending"
    },
    refundStatus: {
        type: String,
        enum: [
            "Not Requested",
            "Pending",
            "Initiated",
            "Rejected",
            "Refunded"
        ],
        default: "Not Requested"
    },
    refundId: String,
    refundDate: Date,
    refundRequestedAt: Date,
    refundEligibleAmount: Number
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema, 'bookings');