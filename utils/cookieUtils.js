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
        secure: true,          // Required for SameSite: 'none'
        sameSite: 'none',      // Critical for cross-domain auth
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
/**
 * Unified helper to clear the authentication cookie.
 * Matches exact attributes used in setAuthCookie.
 * Also clears potential legacy versions (partitioned/non-partitioned).
 * @param {Object} res - Express response object
 */
export const clearAuthCookie = (res) => {
    // Clear standard version
    res.cookie('jwt', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        expires: new Date(0),
        maxAge: 0,
        path: '/',
    });

    // Clear partitioned version (just in case it was set previously)
    res.append('Set-Cookie', 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned');

    // Clear non-SameSite version (just in case of old setup)
    res.append('Set-Cookie', 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
};
