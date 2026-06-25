const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const webhookLogSchema = new Schema({
    eventId: {
        type: String,
        required: true,
        unique: true
    },
    eventType: {
        type: String
    },
    payload: {
        type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('WebhookLog', webhookLogSchema, 'webhookLogs');