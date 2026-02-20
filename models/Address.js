import mongoose from 'mongoose';

const addressSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    fullName: {
        type: String,
        required: true,
    },
    mobileNumber: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    houseNumber: {
        type: String,
        required: true,
    },
    landmark: {
        type: String,
        default: '',
    },
    addressType: {
        type: String,
        enum: ['Home', 'Office'],
        default: 'Home',
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

const Address = mongoose.model('Address', addressSchema);

export default Address;
