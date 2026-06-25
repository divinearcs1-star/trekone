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
    resetTokenExpiry: Date
});

module.exports = mongoose.model('user', userSchema, 'users');