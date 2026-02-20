import mongoose from 'mongoose';

const doctorBookingSchema = mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor',
            required: true,
        },
        doctorName: {
            type: String,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        patientName: {
            type: String,
            required: true,
        },
        patientEmail: {
            type: String,
            required: true,
        },
        patientPhone: {
            type: String,
            required: true,
        },
        consultationType: {
            type: String,
            enum: ['video', 'clinic'],
            default: 'video',
        },
        appointmentDate: {
            type: Date,
            required: true,
        },
        appointmentTime: {
            type: String,
            required: true,
        },
        issue: {
            type: String,
            maxlength: 500,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            default: 'pending',
        },
        paymentId: {
            type: String,
        },
        orderId: {
            type: String,
        },
        prescription: {
            type: String,
        },
        notes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const DoctorBooking = mongoose.model('DoctorBooking', doctorBookingSchema);

export default DoctorBooking;
