import axios from 'axios';
import User from '../models/User.js';

// Verify Google Token
export const verifyGoogleToken = async (token) => {
    try {
        const response = await axios.get(
            `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`
        );
        return response.data;
    } catch (error) {
        console.error('Google token verification failed:', error.message);
        throw new Error('Invalid Google token');
    }
};

// Verify Google ID Token (more secure)
export const verifyGoogleIdToken = async (idToken) => {
    try {
        const response = await axios.get(
            `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${idToken}`,
            {
                headers: { Authorization: `Bearer ${idToken}` },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Google ID token verification failed:', error.message);
        throw new Error('Invalid Google ID token');
    }
};

// Get Google user info
export const getGoogleUserInfo = async (accessToken) => {
    try {
        const response = await axios.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Failed to get Google user info:', error.message);
        throw error;
    }
};

// Verify Facebook Token
export const verifyFacebookToken = async (accessToken, userId) => {
    try {
        const response = await axios.get('https://graph.facebook.com/me', {
            params: {
                access_token: accessToken,
                fields: 'id,name,email,picture.width(500).height(500)',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Facebook token verification failed:', error.message);
        throw new Error('Invalid Facebook token');
    }
};

// Get or create user from OAuth provider
export const getOrCreateOAuthUser = async (provider, userData) => {
    console.log(`[OAuth] Processing ${provider} user:`, JSON.stringify(userData, null, 2));
    try {
        const { id, email, name, picture } = userData;

        if (!email) {
            throw new Error('Email not found in OAuth data');
        }

        // Check if user exists by email
        let user = await User.findOne({ email });

        if (user) {
            console.log('[OAuth] User found, updating...');
            // Update OAuth info if user already exists
            if (!user.oauthProvider || user.oauthProvider === 'local') {
                user.oauthProvider = provider;
                user.oauthId = id;
            }
            if (picture && !user.profileImage) {
                user.profileImage = picture.data?.url || picture;
            }
            await user.save();
            console.log('[OAuth] User updated.');
            return user;
        }

        console.log('[OAuth] Creating new user...');
        // Create new user
        user = new User({
            name: name || email.split('@')[0],
            email,
            oauthProvider: provider,
            oauthId: id,
            profileImage: picture?.data?.url || picture || '',
            password: '', // No password for OAuth users
        });

        await user.save();
        console.log('[OAuth] New user created.');
        return user;
    } catch (error) {
        console.error('[OAuth] Error getting/creating OAuth user:', error);
        if (error.name === 'ValidationError') {
            console.error('[OAuth] Validation Errors:', error.errors);
        }
        throw error;
    }
};

// Format user response
export const formatUserResponse = (user) => {
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        avatar: user.avatar || user.profileImage,
        profileImage: user.profileImage,
        oauthProvider: user.oauthProvider,
    };
};
