import jwt from 'jsonwebtoken';
import {
    getGoogleUserInfo,
    verifyFacebookToken,
    getOrCreateOAuthUser,
    formatUserResponse,
} from '../utils/oauthService.js';
import { setAuthCookie } from '../utils/cookieUtils.js';

// Token generation moved to utils/cookieUtils.js

// ================= GOOGLE LOGIN =================

// @desc    Google OAuth callback
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
    try {
        const { accessToken, idToken } = req.body;

        if (!accessToken && !idToken) {
            return res.status(400).json({ message: 'Access token or ID token is required' });
        }

        let googleUser;

        try {
            googleUser = await getGoogleUserInfo(accessToken || idToken);
        } catch (error) {
            return res.status(401).json({ message: 'Failed to verify Google token' });
        }

        const user = await getOrCreateOAuthUser('google', googleUser);

        // ✅ Generate JWT Cookie
        setAuthCookie(res, user._id);

        res.status(200).json({
            message: 'Logged in successfully',
            user: formatUserResponse(user),
        });

    } catch (error) {
        console.error('Google auth error:', error.message);
        res.status(500).json({
            message: 'Google authentication failed',
            error: error.message
        });
    }
};

// ================= FACEBOOK LOGIN =================

// @desc    Facebook OAuth callback
// @route   POST /api/auth/facebook
// @access  Public
export const facebookAuth = async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ message: 'Access token is required' });
        }

        let facebookUser;

        try {
            facebookUser = await verifyFacebookToken(accessToken);
        } catch (error) {
            return res.status(401).json({ message: 'Failed to verify Facebook token' });
        }

        const user = await getOrCreateOAuthUser('facebook', {
            id: facebookUser.id,
            email: facebookUser.email,
            name: facebookUser.name,
            picture: facebookUser.picture,
        });

        // ✅ Generate JWT Cookie
        setAuthCookie(res, user._id);

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

// ================= AUTH STATUS =================

// @desc    Get auth status
// @route   GET /api/auth/status
// @access  Public
export const getAuthStatus = (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || 'NOT_CONFIGURED',
        facebookAppId: process.env.FACEBOOK_APP_ID || 'NOT_CONFIGURED',
    });
};