import express from 'express';
import {
    initiateBookingPayment,
    verifyBookingPayment,
    getUserBookings,
    getAllBookings,
    getBooking,
    cancelBooking,
    updateBooking,
} from '../controllers/doctorBookingController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Payment routes (public)
router.post('/doctor-booking', initiateBookingPayment);
router.post('/verify-doctor-booking', verifyBookingPayment);

// Booking routes (private)
router.get('/', protect, getUserBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/cancel', protect, cancelBooking);

// Admin booking routes
router.get('/admin/all', protect, admin, getAllBookings);
router.put('/admin/:id', protect, admin, updateBooking);

export default router;
