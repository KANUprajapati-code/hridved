import express from 'express';
import DoctorBooking from '../models/DoctorBooking.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Initiate doctor booking payment
router.post('/doctor-booking', async (req, res, next) => {
    try {
        console.log('Doctor booking request body:', req.body);
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
            amount: amount * 100,
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
});

// Verify doctor booking payment
router.post('/verify-doctor-booking', async (req, res, next) => {
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
});

export default router;
