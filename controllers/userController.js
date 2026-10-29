import User from '../models/User.js';
import Otp from '../models/Otp.js';
import AudienceLead from '../models/AudienceLead.js';
import { sendSMS } from '../utils/smsService.js';
import jwt from 'jsonwebtoken';
import { setAuthCookie, clearAuthCookie } from '../utils/cookieUtils.js';

// Token generation moved to utils/cookieUtils.js

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        setAuthCookie(res, user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: setAuthCookie(res, user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400).json({ message: 'User already exists' });
        return;
    }

    const user = await User.create({
        name,
        email,
        password,
    });

    if (user) {
        setAuthCookie(res, user._id);
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: setAuthCookie(res, user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = (req, res) => {
    console.log('[AUTH] Logout requested. Clearing cookie...');
    clearAuthCookie(res);
    res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    console.log(`[AUTH] Profile requested for user: ${req.user?._id}`);
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            avatar: user.avatar,
            phone: user.phone,
            address: user.address,
            city: user.city,
            postalCode: user.postalCode,
            country: user.country,
            addresses: user.addresses || [],
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.avatar = req.body.avatar || user.avatar;
        user.phone = req.body.phone || user.phone;
        user.address = req.body.address || user.address;
        user.city = req.body.city || user.city;
        user.postalCode = req.body.postalCode || user.postalCode;
        user.country = req.body.country || user.country;

        // Support for addresses array (multiple saved addresses)
        if (req.body.addresses && Array.isArray(req.body.addresses)) {
            user.addresses = req.body.addresses;
        }

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin,
            avatar: updatedUser.avatar,
            phone: updatedUser.phone,
            address: updatedUser.address,
            city: updatedUser.city,
            postalCode: updatedUser.postalCode,
            country: updatedUser.country,
            addresses: updatedUser.addresses || [],
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    const users = await User.find({});
    res.json(users);
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        if (user.isAdmin) {
            res.status(400);
            throw new Error('Cannot delete admin user');
        }
        await user.deleteOne();
        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.isAdmin = Boolean(req.body.isAdmin);

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Send OTP to phone
// @route   POST /api/users/otp/send
// @access  Public
const sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Clean phone number (extract last 10 digits)
        const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
        }

        // Enforce 60-second cooldown rate limit per phone
        const existingOtp = await Otp.findOne({ phone: cleanPhone });
        if (existingOtp && existingOtp.updatedAt) {
            const secondsSinceLastSend = Math.floor((Date.now() - new Date(existingOtp.updatedAt).getTime()) / 1000);
            if (secondsSinceLastSend < 60) {
                const waitSeconds = 60 - secondsSinceLastSend;
                return res.status(429).json({ 
                    message: `Please wait ${waitSeconds}s before requesting a new OTP.`,
                    retryAfter: waitSeconds
                });
            }
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Upsert OTP record
        await Otp.findOneAndUpdate(
            { phone: cleanPhone },
            { otp: otpCode, expiresAt, verified: false, attempts: 0 },
            { upsert: true, new: true }
        );

        // Send OTP via SMS service
        const smsResult = await sendSMS(cleanPhone, otpCode);

        // Capture as lead for marketing follow-up
        try {
            const existingUser = await User.findOne({ phone: cleanPhone });
            await AudienceLead.create({
                customerName: existingUser ? existingUser.name : 'Lead ' + cleanPhone.slice(-4),
                phone: cleanPhone,
                user: existingUser ? existingUser._id : null,
                actionType: 'otp_lead',
                followUpStatus: 'New',
                notes: [{ text: 'Requested OTP verification code', addedBy: 'System' }],
            });
        } catch (leadErr) {
            console.error('Lead tracking error in sendOtp:', leadErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `OTP sent successfully to +91 ${cleanPhone}`,
            // In development or when simulated, provide devOtp for effortless local testing
            devOtp: process.env.NODE_ENV !== 'production' || smsResult.simulated ? otpCode : undefined,
        });
    } catch (error) {
        console.error('sendOtp Error:', error);
        return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
};

// @desc    Verify OTP and log in or register user
// @route   POST /api/users/otp/verify
// @access  Public
const verifyOtp = async (req, res) => {
    try {
        const { phone, otp, name } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ message: 'Phone number and OTP are required' });
        }

        const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
        const enteredOtp = otp.toString().trim();

        // Check OTP record
        const otpRecord = await Otp.findOne({ phone: cleanPhone });

        if (!otpRecord) {
            return res.status(400).json({ message: 'No active OTP found. Please request a new code.' });
        }

        // Check expiry
        if (new Date() > new Date(otpRecord.expiresAt)) {
            await Otp.deleteMany({ phone: cleanPhone });
            return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
        }

        // Check attempts limit (max 5)
        if (otpRecord.attempts >= 5) {
            await Otp.deleteMany({ phone: cleanPhone });
            return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
        }

        // Verify match
        if (otpRecord.otp !== enteredOtp) {
            otpRecord.attempts = (otpRecord.attempts || 0) + 1;
            await otpRecord.save();
            const remaining = 5 - otpRecord.attempts;
            return res.status(400).json({ 
                message: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` 
            });
        }

        // Delete used OTP
        await Otp.deleteMany({ phone: cleanPhone });

        // Find or create User
        let user = await User.findOne({ phone: cleanPhone });

        if (!user) {
            // Check if user has dummy email or match by phone email
            const fallbackEmail = `${cleanPhone}@hridved.in`;
            user = await User.findOne({ email: fallbackEmail });
        }

        if (!user) {
            // Register new user via phone OTP
            user = await User.create({
                name: name && name.trim() ? name.trim() : `Customer ${cleanPhone.slice(-4)}`,
                email: `${cleanPhone}@hridved.in`,
                phone: cleanPhone,
                password: Math.random().toString(36).slice(-8),
                isAdmin: false,
                oauthProvider: 'phone_otp',
            });
        } else {
            // Update phone or name if needed
            if (!user.phone) {
                user.phone = cleanPhone;
            }
            if (name && name.trim() && user.name.startsWith('Customer ')) {
                user.name = name.trim();
            }
            await user.save();
        }

        // Issue auth token & cookie
        const token = setAuthCookie(res, user._id);

        // Update all related audience leads with user ID and name
        try {
            await AudienceLead.updateMany(
                { phone: cleanPhone },
                { user: user._id, customerName: user.name }
            );
        } catch (leadUpdateErr) {
            console.error('Lead update error in verifyOtp:', leadUpdateErr.message);
        }

        return res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isAdmin: user.isAdmin,
            token,
        });
    } catch (error) {
        console.error('verifyOtp Error:', error);
        return res.status(500).json({ message: 'Failed to verify OTP' });
    }
};

// @desc    Authenticate or register user via Firebase Phone Auth
// @route   POST /api/users/firebase-login
// @access  Public
const firebasePhoneLogin = async (req, res) => {
    try {
        const { phone, name, uid } = req.body;
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
            return res.status(400).json({ message: 'Invalid phone number' });
        }

        // Find or create User in MongoDB
        let user = await User.findOne({ phone: cleanPhone });

        if (!user) {
            const fallbackEmail = `${cleanPhone}@hridved.in`;
            user = await User.findOne({ email: fallbackEmail });
        }

        if (!user) {
            user = await User.create({
                name: name && name.trim() ? name.trim() : `Customer ${cleanPhone.slice(-4)}`,
                email: `${cleanPhone}@hridved.in`,
                phone: cleanPhone,
                password: Math.random().toString(36).slice(-8),
                isAdmin: false,
                oauthProvider: 'firebase_phone',
            });
        } else {
            if (!user.phone) {
                user.phone = cleanPhone;
            }
            if (name && name.trim() && user.name.startsWith('Customer ')) {
                user.name = name.trim();
            }
            await user.save();
        }

        // Issue auth token & cookie
        const token = setAuthCookie(res, user._id);

        // Update audience lead
        try {
            await AudienceLead.updateMany(
                { phone: cleanPhone },
                { user: user._id, customerName: user.name }
            );
        } catch (leadUpdateErr) {
            console.error('Lead update error in firebasePhoneLogin:', leadUpdateErr.message);
        }

        return res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isAdmin: user.isAdmin,
            token,
        });
    } catch (error) {
        console.error('firebasePhoneLogin Error:', error);
        return res.status(500).json({ message: 'Firebase authentication failed' });
    }
};

// @desc    Get user's wishlist
// @route   GET /api/users/wishlist
// @access  Private
const getUserWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('wishlist');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json(user.wishlist || []);
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return res.status(500).json({ message: 'Server error fetching wishlist' });
    }
};

// @desc    Toggle item in wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
const toggleUserWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isExisting = user.wishlist.some(id => id.toString() === productId);

        if (isExisting) {
            user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        } else {
            user.wishlist.push(productId);
        }

        await user.save();

        const updatedUser = await User.findById(req.user._id).populate('wishlist');
        return res.status(200).json({
            isWishlisted: !isExisting,
            wishlist: updatedUser.wishlist || [],
        });
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        return res.status(500).json({ message: 'Server error updating wishlist' });
    }
};

// @desc    Sync local wishlist with server on login
// @route   POST /api/users/wishlist/sync
// @access  Private
const syncUserWishlist = async (req, res) => {
    try {
        const { productIds } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (Array.isArray(productIds)) {
            const currentWishlistSet = new Set(user.wishlist.map(id => id.toString()));
            productIds.forEach(id => {
                if (id && !currentWishlistSet.has(id.toString())) {
                    user.wishlist.push(id);
                }
            });
            await user.save();
        }

        const updatedUser = await User.findById(req.user._id).populate('wishlist');
        return res.status(200).json(updatedUser.wishlist || []);
    } catch (error) {
        console.error('Error syncing wishlist:', error);
        return res.status(500).json({ message: 'Server error syncing wishlist' });
    }
};

export {
    authUser,
    registerUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    getUsers,
    deleteUser,
    getUserById,
    updateUser,
    sendOtp,
    verifyOtp,
    firebasePhoneLogin,
    getUserWishlist,
    toggleUserWishlist,
    syncUserWishlist,
};

