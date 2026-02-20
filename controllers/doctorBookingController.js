import DoctorBooking from '../models/DoctorBooking.js';
import Doctor from '../models/Doctor.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Initiate doctor booking payment
// @route   POST /api/payment/doctor-booking
// @access  Public
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
        } = req.body;

        // Validate required fields
        if (!doctorId || !patientName || !patientEmail || !patientPhone || !appointmentDate || !appointmentTime || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Create Razorpay order
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: `doctor-booking-${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        // Create pending booking record
        const booking = new DoctorBooking({
            doctorId,
            doctorName,
            patientName,
            patientEmail,
            patientPhone,
            consultationType,
            appointmentDate: new Date(appointmentDate),
            appointmentTime,
            issue,
            amount,
            orderId: order.id,
            status: 'pending',
        });

        await booking.save();

        res.json({
            success: true,
            razorpayOrderId: order.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            amount: amount * 100,
            bookingId: booking._id,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify doctor booking payment
// @route   POST /api/payment/verify-doctor-booking
// @access  Public
const verifyBookingPayment = async (req, res, next) => {
    try {
        const { orderId, paymentId, signature } = req.body;

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        if (generatedSignature !== signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Update booking status
        const booking = await DoctorBooking.findOneAndUpdate(
            { orderId },
            {
                status: 'confirmed',
                paymentId,
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.json({
            success: true,
            message: 'Payment verified successfully',
            booking,
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
        const { status, prescription, notes } = req.body;
        const booking = await DoctorBooking.findByIdAndUpdate(
            req.params.id,
            {
                status,
                prescription,
                notes,
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
};
