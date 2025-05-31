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
        const { 
            restaurantId, 
            date, 
            time,
            numberOfGuests,
            name,
            surname,
            phoneNumber,
            notes 
        } = req.body;

        // Validate required fields
        if (!restaurantId || !date || !time || !numberOfGuests || !name || !surname || !phoneNumber) {
            return res.status(400).json({ message: "Barcha majburiy maydonlarni to'ldiring" });
        }

        // Combine date and time
        const reservationDateTime = new Date(`${date}T${time}`);

        // Check if date is available
        const existingReservation = await Reservation.findOne({
            restaurant: restaurantId,
            date: reservationDateTime,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingReservation) {
            return res.status(400).json({ message: 'Bu vaqtda bron mavjud' });
        }

        const reservation = new Reservation({
            restaurant: restaurantId,
            bookedBy: req.user.id,
            date: reservationDateTime,
            numberOfGuests,
            customerName: `${name} ${surname}`,
            customerPhone: phoneNumber,
            notes,
            status: 'pending'
        });

        await reservation.save();
        res.status(201).json(reservation);
    } catch (err) {
        console.error('Error creating reservation:', err);
        res.status(500).json({ message: 'Bron qo\'shishda xatolik yuz berdi' });
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
