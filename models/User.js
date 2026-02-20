import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        default: '', // Optional for OAuth users
    },
    isAdmin: {
        type: Boolean,
        required: true,
        default: false,
    },
    avatar: {
        type: String,
        default: '',
    },
    // OAuth fields
    oauthProvider: {
        type: String,
        enum: ['local', 'google', 'facebook'],
        default: 'local',
    },
    oauthId: {
        type: String,
        default: '',
    },
    profileImage: {
        type: String,
        default: '',
    },
    address: {
        type: String,
        default: '',
    },
    city: {
        type: String,
        default: '',
    },
    postalCode: {
        type: String,
        default: '',
    },
    country: {
        type: String,
        default: '',
    },
    addresses: [{
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
        phone: { type: String, required: true },
    }],
    phone: {
        type: String,
        default: '',
    },
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    }],
}, {
    timestamps: true,
});

// Match user password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password before saving (skip for OAuth users)
userSchema.pre('save', async function () {
    console.log('[User Middleware] Pre-save hook triggered for:', this.email);
    if (!this.isModified('password') || !this.password) {
        console.log('[User Middleware] Skipping password encryption');
        return;
    }
    console.log('[User Middleware] Encrypting password');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

export default User;
