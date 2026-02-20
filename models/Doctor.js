import mongoose from 'mongoose';

const doctorSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    specialization: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    experience: {
        type: String,
        required: true,
    },
    patients: {
        type: String,
        required: true,
    },
    languages: [{
        type: String,
    }],
    fee: {
        type: Number,
        required: true,
        default: 0,
    },
    tags: [{
        type: String,
    }],
    quote: {
        type: String,
        required: true,
    },
    available: {
        type: Boolean,
        default: true,
    },
    isVerified: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
