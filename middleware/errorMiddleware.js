// 404 Not Found Handler
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

// Comprehensive Error Handler
const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;
    let errors = {};

    // Log error in development
    console.error(`[SERVE ERROR] ${req.method} ${req.originalUrl} - Status: ${statusCode}`);
    console.error('Message:', message);
    console.error('Stack:', err.stack);
    if (req.body && Object.keys(req.body).length > 0) {
        console.error('Body:', JSON.stringify(req.body, null, 2));
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errors = Object.keys(err.errors).reduce((acc, key) => {
            acc[key] = err.errors[key].message;
            return acc;
        }, {});
        message = 'Validation Error';
    }

    // Mongoose CastError (Invalid ID)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 400;
        message = 'Invalid resource ID format';
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        errors[field] = message;
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Custom error handling for known error types
    if (err.isCustom) {
        statusCode = err.statusCode || 400;
        message = err.message;
    }

    // Prevent exposing sensitive info in production
    const errorResponse = {
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
        ...(Object.keys(errors).length > 0 && { errors }),
    };

    res.status(statusCode).json(errorResponse);
};

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { notFound, errorHandler };
