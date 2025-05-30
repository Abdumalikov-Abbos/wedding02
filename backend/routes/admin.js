const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Reservation = require('../models/Reservation');
const auth = require('../middleware/auth');

// Get dashboard statistics (admin only)
router.get('/stats', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Ruxsat rad etildi' });
        }

        // Get total counts
        const totalUsers = await User.countDocuments();
        const totalRestaurants = await Restaurant.countDocuments();
        const totalReservations = await Reservation.countDocuments();

        // Get recent restaurants (last 5)
        const recentRestaurants = await Restaurant.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('owner', 'username');

        // Get recent reservations (last 5)
        const recentReservations = await Reservation.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('restaurant', 'name')
            .populate('bookedBy', 'username');

        res.json({
            totalUsers,
            totalRestaurants,
            totalReservations,
            recentRestaurants,
            recentReservations
        });
    } catch (err) {
        console.error('Error fetching admin stats:', err);
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

module.exports = router; 