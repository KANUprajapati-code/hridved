// Input validation middleware

// Sanitize user input to prevent XSS
const sanitizeInput = (obj) => {
    if (typeof obj === 'string') {
        return obj
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }
    if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'string') {
                    sanitized[key] = sanitizeInput(obj[key]);
                } else if (Array.isArray(obj[key])) {
                    sanitized[key] = obj[key].map(item => 
                        typeof item === 'object' ? sanitizeInput(item) : item
                    );
                } else if (typeof obj[key] === 'object') {
                    sanitized[key] = sanitizeInput(obj[key]);
                } else {
                    sanitized[key] = obj[key];
                }
            }
        }
        return sanitized;
    }
    return obj;
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate phone (Indian format)
const isValidPhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
};

// Validate postal code (Indian)
const isValidPostalCode = (code) => {
    return /^\d{6}$/.test(code);
};

// Validate product name
const isValidProductName = (name) => {
    return name && name.trim().length >= 3 && name.trim().length <= 200;
};

// Validate price
const isValidPrice = (price) => {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice > 0 && numPrice < 1000000;
};

// Validate quantity
const isValidQuantity = (qty) => {
    const numQty = parseInt(qty);
    return !isNaN(numQty) && numQty > 0 && numQty <= 10000;
};

// General sanitization middleware
export const sanitizeBody = (req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = sanitizeInput(req.body[key]);
                } else if (typeof req.body[key] === 'object') {
                    req.body[key] = sanitizeInput(req.body[key]);
                }
            }
        }
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
        for (const key in req.params) {
            if (Object.prototype.hasOwnProperty.call(req.params, key)) {
                if (typeof req.params[key] === 'string') {
                    req.params[key] = sanitizeInput(req.params[key]);
                }
            }
        }
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        for (const key in req.query) {
            if (Object.prototype.hasOwnProperty.call(req.query, key)) {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = sanitizeInput(req.query[key]);
                }
            }
        }
    }

    next();
};

// Validate product data
export const validateProductData = (req, res, next) => {
    const { name, price, category, description } = req.body;

    const errors = {};

    if (!isValidProductName(name)) {
        errors.name = 'Product name must be 3-200 characters';
    }

    if (!isValidPrice(price)) {
        errors.price = 'Price must be a valid number between 1 and 999999';
    }

    if (!category || category.trim().length === 0) {
        errors.category = 'Category is required';
    }

    if (!description || description.trim().length < 10) {
        errors.description = 'Description must be at least 10 characters';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors,
        });
    }

    next();
};

// Validate address data
export const validateAddressData = (req, res, next) => {
    const { firstName, lastName, phone, address, city, state, postalCode } = req.body;

    const errors = {};

    if (!firstName || firstName.trim().length < 2) {
        errors.firstName = 'First name must be at least 2 characters';
    }

    if (!lastName || lastName.trim().length < 2) {
        errors.lastName = 'Last name must be at least 2 characters';
    }

    if (!isValidPhone(phone)) {
        errors.phone = 'Invalid phone number';
    }

    if (!address || address.trim().length < 5) {
        errors.address = 'Address must be at least 5 characters';
    }

    if (!city || city.trim().length < 2) {
        errors.city = 'City name is invalid';
    }

    if (!state || state.trim().length < 2) {
        errors.state = 'State name is invalid';
    }

    if (!isValidPostalCode(postalCode)) {
        errors.postalCode = 'Postal code must be 6 digits';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Address validation failed',
            errors,
        });
    }

    next();
};

// Validate cart item
export const validateCartItem = (req, res, next) => {
    const { product, qty, price } = req.body;

    if (!product) {
        return res.status(400).json({
            success: false,
            message: 'Product ID is required',
        });
    }

    if (!isValidQuantity(qty)) {
        return res.status(400).json({
            success: false,
            message: 'Quantity must be between 1 and 10000',
        });
    }

    if (price !== undefined && !isValidPrice(price)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid price',
        });
    }

    next();
};

// Validate order data
export const validateOrderData = (req, res, next) => {
    const { orderItems, shippingAddress, paymentMethod, totalPrice } = req.body;

    const errors = {};

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        errors.orderItems = 'Order must have at least one item';
    }

    if (!shippingAddress) {
        errors.shippingAddress = 'Shipping address is required';
    }

    if (!paymentMethod || !['Razorpay', 'Stripe', 'COD'].includes(paymentMethod)) {
        errors.paymentMethod = 'Valid payment method is required';
    }

    if (!totalPrice || !isValidPrice(totalPrice)) {
        errors.totalPrice = 'Valid total price is required';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Order validation failed',
            errors,
        });
    }

    next();
};

export default {
    sanitizeInput,
    sanitizeBody,
    isValidEmail,
    isValidPhone,
    isValidPostalCode,
    isValidProductName,
    isValidPrice,
    isValidQuantity,
    validateProductData,
    validateAddressData,
    validateCartItem,
    validateOrderData,
};
