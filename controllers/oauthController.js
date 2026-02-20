import jwt from 'jsonwebtoken';
import {
    getGoogleUserInfo,
    verifyFacebookToken,
    getOrCreateOAuthUser,
    formatUserResponse,
} from '../utils/oauthService.js';

// Generate JWT Helper
const generateToken = (res, userId) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
};

// @desc    Google OAuth callback
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
    try {
        const { accessToken, idToken } = req.body;

        if (!accessToken && !idToken) {
            return res.status(400).json({ message: 'Access token or ID token is required' });
        }

        // Get user info from Google
        let googleUser;
        try {
            googleUser = await getGoogleUserInfo(accessToken || idToken);
        } catch (error) {
            return res.status(401).json({ message: 'Failed to verify Google token' });
        }

        // Get or create user
        const user = await getOrCreateOAuthUser('google', googleUser);

        // Generate JWT
        generateToken(res, user._id);

        res.status(200).json({
            message: 'Logged in successfully',
            user: formatUserResponse(user),
        });
    } catch (error) {
        console.error('Google auth error:', error.message);
        res.status(500).json({ message: 'Google authentication failed', error: error.message });
    }
};

// @desc    Facebook OAuth callback
// @route   POST /api/auth/facebook
// @access  Public
export const facebookAuth = async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ message: 'Access token is required' });
        }

        // Verify token and get user info from Facebook
        let facebookUser;
        try {
            facebookUser = await verifyFacebookToken(accessToken);
        } catch (error) {
            return res.status(401).json({ message: 'Failed to verify Facebook token' });
        }

        // Get or create user
        const user = await getOrCreateOAuthUser('facebook', {
            id: facebookUser.id,
            email: facebookUser.email,
            name: facebookUser.name,
            picture: facebookUser.picture,
        });

        // Generate JWT
        generateToken(res, user._id);

        res.status(200).json({
            message: 'Logged in successfully',
            user: formatUserResponse(user),
        });
    } catch (error) {
        console.error('Facebook auth error:', error.message);
        res.status(500).json({
            message: 'Facebook authentication failed',
            error: error.message,
        });
    }
};

// @desc    Get auth status
// @route   GET /api/auth/status
// @access  Public
export const getAuthStatus = (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || 'NOT_CONFIGURED',
        facebookAppId: process.env.FACEBOOK_APP_ID || 'NOT_CONFIGURED',
    });
};
