const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const bcrypt = require('bcrypt');

// Create restaurant owner (admin only)
router.post('/owner', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Ruxsat rad etildi' });
        }

        const { username, password, fullName, phone } = req.body;

        // Validate required fields
        if (!username || !password || !fullName || !phone) {
            return res.status(400).json({ message: "Barcha maydonlarni to'ldiring" });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Bu username allaqachon mavjud" });
        }

        // Encrypt password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new restaurant owner
        const owner = new User({
            username,
            password: hashedPassword,
            fullName,
            phone,
            role: 'restaurant_owner'
        });

        await owner.save();

        // Return user without password
        const userResponse = owner.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: "To'yxona egasi muvaffaqiyatli qo'shildi",
            user: userResponse
        });
    } catch (err) {
        console.error('Error creating restaurant owner:', err);
        res.status(500).json({ message: 'To\'yxona egasini qo\'shishda xatolik yuz berdi' });
    }
});

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Ruxsat rad etildi' });
        }

        // Fetch users and populate the ownedRestaurants field
        const users = await User.find()
            .populate('ownedRestaurants', 'name address') // Populate ownedRestaurants and select name/address
            .select('-password'); // Exclude password

        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

// Update user role (admin only)
router.put('/:id/role', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Ruxsat rad etildi' });
        }

        const { role } = req.body;
        if (!['user', 'admin', 'restaurant_owner'].includes(role)) {
            return res.status(400).json({ message: 'Noto\'g\'ri rol' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }

        res.json(user);
    } catch (err) {
        console.error('Error updating user role:', err);
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

// Delete user (admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Ruxsat rad etildi' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }

        res.json({ message: 'Foydalanuvchi o\'chirildi' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
    }
});

module.exports = router; 