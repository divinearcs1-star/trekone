const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone: Number,
    city: String,
    resetToken: String,
    resetTokenExpiry: Date,
    refreshToken: {
        type: String,
        default: null
    },
    role: {
        type: String,
        default: "user"
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema, 'users');