import DoctorBooking from '../models/DoctorBooking.js';
import Doctor from '../models/Doctor.js';
import Coupon from '../models/Coupon.js';
import whatsappService from '../utils/whatsappService.js';

const initiateBookingPayment = async (req, res, next) => {
    try {
        const {
            doctorId,
            doctorName,
            consultationType,
            appointmentDate,
            appointmentTime,
            patientName,
            patientEmail,
            patientPhone,
            issue,
            amount,
            couponCode,
        } = req.body;

        // Validate required fields
        const requiredFields = { doctorId, doctorName, patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, amount };
        const missingFields = Object.keys(requiredFields).filter(key =>
            requiredFields[key] === undefined ||
            requiredFields[key] === null ||
            requiredFields[key] === ''
        );

        if (missingFields.length > 0) {
            console.log('[DOCTOR-BOOKING] Missing fields:', missingFields);
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Check if slot is already booked
        const dateObj = new Date(appointmentDate);
        const existingBooking = await DoctorBooking.findOne({
            doctorId,
            appointmentDate: dateObj,
            appointmentTime,
            status: { $in: ['confirmed', 'pending'] }
        });

        if (existingBooking) {
            console.log('[DOCTOR-BOOKING] Slot already booked or pending:', { doctorId, dateObj, appointmentTime });
            return res.status(400).json({ message: 'This time slot is already booked or being processed' });
        }

        let finalAmount = amount;
        let couponDiscount = 0;

        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (coupon) {
                if (coupon.expiryDate >= new Date() && amount >= coupon.minOrderAmount) {
                    if (coupon.type === 'percentage') {
                        couponDiscount = (amount * coupon.discount) / 100;
                    } else {
                        couponDiscount = coupon.discount;
                    }
                    finalAmount = amount - couponDiscount;
                    if (finalAmount < 0) finalAmount = 0;
                }
            }
        }

        // Generate mock booking order ID
        const mockOrderId = `book_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

        // Create confirmed booking record directly
        const booking = new DoctorBooking({
            doctorId,
            doctorName,
            patientName,
            patientEmail,
            patientPhone,
            consultationType,
            appointmentDate: dateObj,
            appointmentTime,
            issue,
            amount: finalAmount,
            originalAmount: amount,
            couponCode: couponCode ? couponCode.toUpperCase() : undefined,
            couponDiscount,
            orderId: mockOrderId,
            status: 'confirmed', // Confirm directly since Razorpay is removed
        });

        await booking.save();

        // Send WhatsApp confirmation notification
        try {
            await whatsappService.sendBookingConfirmation(booking);
        } catch (waErr) {
            console.warn('[DOCTOR-BOOKING] WhatsApp confirmation failed:', waErr.message);
        }

        res.json({
            success: true,
            bookingId: booking._id,
            razorpayOrderId: mockOrderId,
            amount: Math.round(finalAmount * 100),
            message: 'Booking confirmed successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get booked slots for a doctor on a specific date
// @route   GET /api/doctor-bookings/booked-slots/:doctorId/:date
// @access  Public
const getBookedSlots = async (req, res, next) => {
    try {
        const { doctorId, date } = req.params;
        const dateObj = new Date(date);

        const bookings = await DoctorBooking.find({
            doctorId,
            appointmentDate: dateObj,
            status: { $in: ['confirmed', 'pending'] }
        }).select('appointmentTime');

        const bookedSlots = bookings.map(b => b.appointmentTime);
        res.json(bookedSlots);
    } catch (error) {
        next(error);
    }
};

// @desc    Verify doctor booking payment
// @route   POST /api/payment/verify-doctor-booking
// @access  Public
const verifyBookingPayment = async (req, res, next) => {
    try {
        res.json({
            success: true,
            message: 'Payment verified successfully (Mock)'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all bookings for a user
// @route   GET /api/doctor-bookings
// @access  Private
const getUserBookings = async (req, res, next) => {
    try {
        const bookings = await DoctorBooking.find({
            $or: [
                { userId: req.user._id },
                { patientEmail: req.user.email },
            ],
        })
            .populate('doctorId')
            .sort({ appointmentDate: -1 });

        res.json(bookings);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all bookings (admin)
// @route   GET /api/admin/doctor-bookings
// @access  Private/Admin
const getAllBookings = async (req, res, next) => {
    try {
        const { status, doctorId } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (doctorId) filter.doctorId = doctorId;

        const bookings = await DoctorBooking.find(filter)
            .populate('doctorId')
            .sort({ appointmentDate: -1 });

        res.json(bookings);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single booking
// @route   GET /api/doctor-bookings/:id
// @access  Private
const getBooking = async (req, res, next) => {
    try {
        const booking = await DoctorBooking.findById(req.params.id).populate('doctorId');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.json(booking);
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel booking
// @route   PUT /api/doctor-bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res, next) => {
    try {
        const booking = await DoctorBooking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Can only cancel if appointment is more than 2 hours away
        const appointmentDateTime = new Date(`${booking.appointmentDate.toISOString().split('T')[0]}T${booking.appointmentTime}`);
        const now = new Date();
        const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

        if (hoursUntilAppointment < 2) {
            return res.status(400).json({ message: 'Cannot cancel within 2 hours of appointment' });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.json({ message: 'Booking cancelled successfully', booking });
    } catch (error) {
        next(error);
    }
};

// @desc    Update booking status (admin)
// @route   PUT /api/admin/doctor-bookings/:id
// @access  Private/Admin
const updateBooking = async (req, res, next) => {
    try {
        const { status, prescription, notes, googleMeetLink, meetingStatus } = req.body;
        const booking = await DoctorBooking.findByIdAndUpdate(
            req.params.id,
            {
                status,
                prescription,
                notes,
                googleMeetLink,
                meetingStatus,
            },
            { new: true }
        ).populate('doctorId');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.json(booking);
    } catch (error) {
        next(error);
    }
};

export {
    initiateBookingPayment,
    verifyBookingPayment,
    getUserBookings,
    getAllBookings,
    getBooking,
    cancelBooking,
    updateBooking,
    getBookedSlots,
};
