const express = require("express")
const router = express.Router()
const Restaurant = require("../models/Restaurant")
const auth = require("../middleware/auth")
const multer = require("multer")
const path = require("path")
const fs = require('fs')
const User = require('../models/User')

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
  },
})

const upload = multer({ storage: storage })

// @desc    Get all restaurants (admin view: all statuses) or approved restaurants (public view) with filtering, sorting, and searching
// @route   GET /api/restaurants
// @access  Public (for approved) or Admin (for all)
router.get("/", auth, async (req, res) => {
  try {
    let query;
    const { district, status, sortBy, order, searchTerm } = req.query; // Get query parameters including searchTerm

    let filter = {};
    let sort = {};

    // Check if search term is provided. If so, prioritize search over filters.
    if (searchTerm) {
        const searchRegex = new RegExp(searchTerm, 'i'); // Case-insensitive regex
        filter.$or = [ // Search in multiple fields: name, address, description
            { name: searchRegex },
            { address: searchRegex },
            { description: searchRegex },
        ];
        // Note: When searchTerm is present, district and status filters are ignored as per user request.
    } else { // If no search term, apply filters as usual
        if (district) {
          filter.district = district;
        }
        if (status) {
           // Allow filtering by 'pending', 'approved', 'rejected'
          filter.status = status;
        } else if (!(req.user && req.user.role === 'admin')) {
           // Default filter for non-admins
           filter.status = "approved";
        }
    }


    // Check if the user is an admin
    if (req.user && req.user.role === 'admin') {
      // Admin gets all restaurants based on filters and search
      query = Restaurant.find(filter).populate('owner', 'fullName username');
    } else {
      // Non-admins (public) only get approved restaurants based on filters and search
      // The filter.status = "approved" is already handled above
      query = Restaurant.find(filter).populate('owner', 'fullName username');
    }

    // Apply sorting
    if (sortBy) {
      const sortOrder = order === 'desc' ? -1 : 1;
      // Map frontend sort parameters to backend schema fields
      if (sortBy === 'price') {
        sort.pricePerSeat = sortOrder;
      } else if (sortBy === 'capacity') {
        sort.capacity = sortOrder;
      }
       // Add other sorting options if needed
    } else {
        // Default sort if no sortBy is provided (e.g., by creation date)
        sort.createdAt = -1; // Assuming you have a createdAt field
    }

     query = query.sort(sort); // Apply sorting to the query


    const restaurants = await query.exec(); // Execute the query
    res.json(restaurants)
  } catch (err) {
    console.error('Error fetching restaurants:', err);
    res.status(500).json({ message: 'To\'yxonalarni yuklashda xatolik yuz berdi' })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
    if (!restaurant) {
      return res.status(404).json({ message: "To'yxona topilmadi" })
    }
    res.json(restaurant)
  } catch (err) {
    console.error('Error fetching restaurant:', err);
    res.status(500).json({ message: 'To\'yxonani yuklashda xatolik yuz berdi' })
  }
})

router.post("/", [auth, upload.array("images", 5)], async (req, res) => {
  try {
    const { name, address, district, capacity, pricePerSeat, phone } = req.body

    // Validate required fields
    if (!name || !address || !district || !capacity || !pricePerSeat || !phone) {
      return res.status(400).json({ message: "Barcha maydonlarni to'ldiring" })
    }

    // Validate district
    const validDistricts = ['Yunusobod', 'Yakkasaroy', 'Mirobod', 'Mirzo-Ulugbek', 'Olmos', 'Sergeli', 'Shaykhantaur', 'Uchtepa', 'Yashnobod', 'Chilonzor']
    if (!validDistricts.includes(district)) {
      return res.status(400).json({ message: "Noto'g'ri tuman" })
    }

    // Validate numeric fields
    if (isNaN(capacity) || isNaN(pricePerSeat)) {
      return res.status(400).json({ message: "Sig'uvchanlik va narx raqam bo'lishi kerak" })
    }

    const restaurant = new Restaurant({
      name,
      address,
      district,
      capacity: Number(capacity),
      pricePerSeat: Number(pricePerSeat),
      phone,
      owner: req.user.id,
      images: req.files ? req.files.map((file) => file.path) : [],
    })

    await restaurant.save()

    // Find the owner user and add the new restaurant's ID to their ownedRestaurants array
    await User.findByIdAndUpdate(
        restaurant.owner, // The owner is set to req.user.id
        { $push: { ownedRestaurants: restaurant._id } },
        { new: true } // Optional: return the updated user document
    );

    res.json(restaurant)
  } catch (err) {
    console.error('Error creating restaurant:', err);
    res.status(500).json({ message: 'To\'yxona qo\'shishda xatolik yuz berdi' })
  }
})

router.put("/:id", [auth, upload.array("images", 5)], async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
    if (!restaurant) {
      return res.status(404).json({ message: "To'yxona topilmadi" })
    }

    // Check if user is admin or owner
    if (req.user.role !== "admin" && restaurant.owner.toString() !== req.user.id) {
      return res.status(401).json({ message: "Ruxsat rad etildi" })
    }

    const { name, address, district, capacity, pricePerSeat, phone, owner } = req.body // owner ni ham qabul qilamiz

    // Validate district if provided
    if (district) {
      const validDistricts = ['Yunusobod', 'Yakkasaroy', 'Mirobod', 'Mirzo-Ulugbek', 'Olmos', 'Sergeli', 'Shaykhantaur', 'Uchtepa', 'Yashnobod', 'Chilonzor']
      if (!validDistricts.includes(district)) {
        return res.status(400).json({ message: "Noto'g'ri tuman" })
      }
    }

    // Handle owner change
    if (owner && owner !== restaurant.owner.toString()) {
        // Check if the new owner exists
        const newOwner = await User.findById(owner);
        if (!newOwner) {
            return res.status(404).json({ message: "Yangi ega topilmadi" });
        }

        // Remove restaurant from old owner's ownedRestaurants
        if (restaurant.owner) {
             await User.findByIdAndUpdate(
                 restaurant.owner,
                 { $pull: { ownedRestaurants: restaurant._id } },
                 { new: true }
             );
        }

        // Add restaurant to new owner's ownedRestaurants
        await User.findByIdAndUpdate(
            owner,
            { $push: { ownedRestaurants: restaurant._id } },
            { new: true }
        );

        // Update restaurant owner
        restaurant.owner = owner;
    }

    restaurant.name = name || restaurant.name
    restaurant.address = address || restaurant.address
    restaurant.district = district || restaurant.district
    restaurant.capacity = capacity ? Number(capacity) : restaurant.capacity
    restaurant.pricePerSeat = pricePerSeat ? Number(pricePerSeat) : restaurant.pricePerSeat
    restaurant.phone = phone || restaurant.phone
    restaurant.images = req.files ? req.files.map((file) => file.path) : restaurant.images

    await restaurant.save()
    res.json(restaurant) // Yangilangan restoranni qaytarish
  } catch (err) {
    console.error('Error updating restaurant:', err);
    res.status(500).json({ message: 'To\'yxonani yangilashda xatolik yuz berdi' })
  }
})

router.put("/:id/status", auth, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
    if (!restaurant) {
      return res.status(404).json({ message: "To'yxona topilmadi" })
    }

    if (req.user.role !== "admin") {
      return res.status(401).json({ message: "Ruxsat rad etildi" })
    }

    const { status } = req.body
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Noto'g'ri status" })
    }

    restaurant.status = status
    await restaurant.save()
    res.json(restaurant)
  } catch (err) {
    console.error('Error updating restaurant status:', err);
    res.status(500).json({ message: 'To\'yxona statusini yangilashda xatolik yuz berdi' })
  }
})

// Delete restaurant
router.delete("/:id", auth, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
    if (!restaurant) {
      return res.status(404).json({ message: "To'yxona topilmadi" })
    }

    // Check if user is admin or owner
    if (req.user.role !== "admin" && restaurant.owner.toString() !== req.user.id) {
      return res.status(401).json({ message: "Ruxsat rad etildi" })
    }

    // Delete restaurant images from uploads folder
    if (restaurant.images && restaurant.images.length > 0) {
      restaurant.images.forEach(imagePath => {
        const fullPath = path.join(__dirname, '..', imagePath)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      })
    }

    // Delete restaurant from database
    await Restaurant.findByIdAndDelete(req.params.id)

    // Find the owner user and remove the restaurant's ID from their ownedRestaurants array
    await User.findByIdAndUpdate(
        restaurant.owner, // The owner ID stored in the restaurant document
        { $pull: { ownedRestaurants: restaurant._id } },
        { new: true } // Optional: return the updated user document
    );

    res.json({ message: "To'yxona muvaffaqiyatli o'chirildi" })
  } catch (err) {
    console.error('Error deleting restaurant:', err)
    res.status(500).json({ message: 'To\'yxonani o\'chirishda xatolik yuz berdi' })
  }
})

module.exports = router
