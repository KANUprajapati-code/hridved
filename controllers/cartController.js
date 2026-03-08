
import Cart from '../models/Cart.js';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({ user: req.user._id, cartItems: [] });
    }

    res.json(cart);
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
    const { product, name, qty, image, price, gst } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({ user: req.user._id, cartItems: [] });
    }

    const existItem = cart.cartItems.find((x) => String(x.product) === String(product));

    if (existItem) {
        existItem.qty = qty;
    } else {
        cart.cartItems.push({ 
            product, 
            name, 
            qty, 
            image, 
            price, 
            gst: gst || 0 
        });
    }

    await cart.save();
    res.json(cart);
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:id
// @access  Private
const removeFromCart = async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
        const idToRemove = String(req.params.id);
        cart.cartItems = cart.cartItems.filter(
            (x) => String(x.product) !== idToRemove
        );

        await cart.save();
        res.json(cart);
    } else {
        res.status(404);
        throw new Error('Cart not found');
    }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
        cart.cartItems = [];
        await cart.save();
        res.json(cart);
    } else {
        res.status(404);
        throw new Error('Cart not found');
    }
};

// @desc    Merge guest cart items with user cart
// @route   POST /api/cart/merge
// @access  Private
const mergeCart = async (req, res) => {
    const { cartItems } = req.body;

    if (!cartItems || !Array.isArray(cartItems)) {
        res.status(400);
        throw new Error('Invalid cart items');
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({ user: req.user._id, cartItems: [] });
    }

    cartItems.forEach((newItem) => {
        const existItem = cart.cartItems.find(
            (x) => String(x.product) === String(newItem.product)
        );

        if (existItem) {
            // Update quantity if item exists (take the larger one or guest one)
            existItem.qty = newItem.qty;
        } else {
            // Add new item from guest cart
            cart.cartItems.push(newItem);
        }
    });

    await cart.save();
    res.json(cart);
};

export { getCart, addToCart, removeFromCart, clearCart, mergeCart };
