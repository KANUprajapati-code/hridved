import mongoose from 'mongoose';
import Cart from '../models/Cart.js';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, cartItems: [] });
        }

        res.json(cart);
    } catch (error) {
        console.error('Error in getCart:', error);
        res.status(200).json({ cartItems: [] });
    }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
    try {
        const { product, name, qty, image, price, gst, weight } = req.body;

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, cartItems: [] });
        }

        const sid = String(product);
        const existItem = cart.cartItems.find((x) => String(x.product) === sid || String(x._id) === sid);

        if (existItem) {
            existItem.qty = Math.max(1, parseInt(qty) || 1);
        } else {
            cart.cartItems.push({ 
                product: mongoose.Types.ObjectId.isValid(product) ? product : undefined, 
                name: name || 'Ayurvedic Product', 
                qty: Math.max(1, parseInt(qty) || 1), 
                image: image || '/placeholder.png', 
                price: Number(price) || 0, 
                gst: Number(gst) || 0,
                weight: Number(weight) || 0.5
            });
        }

        await cart.save();
        res.json(cart);
    } catch (error) {
        console.error('Error in addToCart:', error);
        const fallbackCart = await Cart.findOne({ user: req.user._id }) || { cartItems: [] };
        res.status(200).json(fallbackCart);
    }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:id
// @access  Private
const removeFromCart = async (req, res) => {
    try {
        const idToRemove = String(req.params.id);

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.json({ cartItems: [] });
        }

        // Filter out item by product ID or subdocument _id
        const initialLength = cart.cartItems.length;
        cart.cartItems = cart.cartItems.filter(
            (x) => String(x.product) !== idToRemove && String(x._id) !== idToRemove
        );

        if (cart.cartItems.length !== initialLength) {
            await cart.save();
        }

        return res.json(cart);
    } catch (error) {
        console.error('Error in removeFromCart, attempting atomic pull:', error);
        try {
            const idToRemove = String(req.params.id);
            const isObjectId = mongoose.Types.ObjectId.isValid(idToRemove);

            const pullQuery = isObjectId
                ? {
                    $or: [
                        { product: new mongoose.Types.ObjectId(idToRemove) },
                        { _id: new mongoose.Types.ObjectId(idToRemove) }
                    ]
                }
                : { product: idToRemove };

            const updatedCart = await Cart.findOneAndUpdate(
                { user: req.user._id },
                { $pull: { cartItems: pullQuery } },
                { new: true }
            );

            return res.json(updatedCart || { cartItems: [] });
        } catch (innerError) {
            console.error('Final fallback in removeFromCart:', innerError);
            const safeCart = await Cart.findOne({ user: req.user._id }).lean();
            return res.json(safeCart || { cartItems: [] });
        }
    }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res) => {
    try {
        let cart = await Cart.findOneAndUpdate(
            { user: req.user._id },
            { $set: { cartItems: [] } },
            { new: true, upsert: true }
        );
        res.json(cart);
    } catch (error) {
        console.error('Error in clearCart:', error);
        res.status(200).json({ cartItems: [] });
    }
};

// @desc    Merge guest cart items with user cart
// @route   POST /api/cart/merge
// @access  Private
const mergeCart = async (req, res) => {
    try {
        const { cartItems } = req.body;

        if (!cartItems || !Array.isArray(cartItems)) {
            let cart = await Cart.findOne({ user: req.user._id });
            return res.json(cart || { cartItems: [] });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, cartItems: [] });
        }

        cartItems.forEach((newItem) => {
            const newPid = String(newItem.product || newItem._id);
            const existItem = cart.cartItems.find(
                (x) => String(x.product) === newPid || String(x._id) === newPid
            );

            if (existItem) {
                existItem.qty = Math.max(1, parseInt(newItem.qty) || 1);
            } else if (newItem && (newItem.product || newItem._id)) {
                cart.cartItems.push({
                    product: mongoose.Types.ObjectId.isValid(newItem.product || newItem._id) 
                        ? (newItem.product || newItem._id) 
                        : undefined,
                    name: newItem.name || 'Ayurvedic Product',
                    qty: Math.max(1, parseInt(newItem.qty) || 1),
                    image: newItem.image || '/placeholder.png',
                    price: Number(newItem.price) || 0,
                    gst: Number(newItem.gst) || 0,
                    weight: Number(newItem.weight) || 0.5
                });
            }
        });

        await cart.save();
        res.json(cart);
    } catch (error) {
        console.error('Error in mergeCart:', error);
        const safeCart = await Cart.findOne({ user: req.user._id }).lean();
        res.status(200).json(safeCart || { cartItems: [] });
    }
};

export { getCart, addToCart, removeFromCart, clearCart, mergeCart };
