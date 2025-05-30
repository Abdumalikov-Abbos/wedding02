const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    bookedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    numberOfGuests: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'bo\'lib o\'tgan'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Add index for efficient querying
reservationSchema.index({ restaurant: 1, date: 1 });
reservationSchema.index({ bookedBy: 1 });

const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);

module.exports = Reservation;
