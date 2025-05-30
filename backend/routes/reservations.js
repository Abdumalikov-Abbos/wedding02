const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const auth = require('../middleware/auth');


router.get('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const reservations = await Reservation.find()
            .populate('restaurant')
            .populate('bookedBy');
        res.json(reservations);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.get('/user', auth, async (req, res) => {
    try {
        const reservations = await Reservation.find({ bookedBy: req.user.id })
            .populate('restaurant');
        res.json(reservations);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.get('/restaurant/:id', auth, async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).json({ msg: 'Restaurant not found' });
        }

        // Check if user is admin or owner
        if (req.user.role !== 'admin' && restaurant.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const reservations = await Reservation.find({ restaurant: req.params.id })
            .populate('bookedBy');
        res.json(reservations);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { restaurantId, date, numberOfPeople } = req.body;

        // Check if date is available
        const existingReservation = await Reservation.findOne({
            restaurant: restaurantId,
            date: date,
            status: 'active'
        });

        if (existingReservation) {
            return res.status(400).json({ msg: 'This date is already reserved' });
        }

        const reservation = new Reservation({
            restaurant: restaurantId,
            bookedBy: req.user.id,
            date,
            numberOfPeople
        });

        await reservation.save();
        res.json(reservation);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) {
            return res.status(404).json({ msg: 'Reservation not found' });
        }

        // Check if user is authorized to cancel
        if (reservation.bookedBy.toString() !== req.user.id && 
            req.user.role !== 'admin' && 
            (reservation.restaurant.owner.toString() !== req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        reservation.status = 'cancelled';
        await reservation.save();
        res.json(reservation);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
