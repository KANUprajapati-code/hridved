import jwt from 'jsonwebtoken';

/**
 * Unified helper to generate and set the authentication cookie.
 * @param {Object} res - Express response object
 * @param {string} userId - ID of the user to authenticate
 */
export const setAuthCookie = (res, userId) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: true,          // MUST be true for SameSite: 'none' (Vercel/Cross-domain)
        sameSite: 'none',      // Critical for cross-domain auth (frontend on one domain, backend on another)
        partitioned: true,     // Helps with iOS/Safari ITP (Third-party cookie restrictions)
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
    });

    return token;
};

/**
 * Unified helper to clear the authentication cookie.
 * Matches exact attributes used in setAuthCookie.
 * @param {Object} res - Express response object
 */
export const clearAuthCookie = (res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        partitioned: true,
        expires: new Date(0),
        maxAge: 0,
        path: '/',
    });
};
