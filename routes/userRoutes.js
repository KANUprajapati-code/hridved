
import express from 'express';
import {
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
} from '../controllers/userController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', registerUser);
router.post('/login', authUser);
router.post('/logout', logoutUser);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/firebase-login', firebasePhoneLogin);
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile);

// Wishlist Endpoints
router.route('/wishlist')
    .get(protect, getUserWishlist);
router.route('/wishlist/sync')
    .post(protect, syncUserWishlist);
router.route('/wishlist/:productId')
    .post(protect, toggleUserWishlist);

router.route('/')
    .get(protect, admin, getUsers);

router.route('/:id')
    .delete(protect, admin, deleteUser)
    .get(protect, admin, getUserById)
    .put(protect, admin, updateUser);

export default router;
