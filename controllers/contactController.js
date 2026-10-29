
import Contact from '../models/Contact.js';

// @desc    Create new contact message
// @route   POST /api/contact
// @access  Public
const createContact = async (req, res) => {
    try {
        const { name, email, phone, message, category, orderNumber, source } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Name, email, and message are required.' });
        }

        const contact = await Contact.create({
            name: String(name).trim().slice(0, 100),
            email: String(email).trim().toLowerCase().slice(0, 100),
            phone: phone ? String(phone).trim().slice(0, 20) : '',
            category: category ? String(category).trim().slice(0, 50) : 'General',
            orderNumber: orderNumber ? String(orderNumber).trim().slice(0, 50) : '',
            source: source ? String(source).trim().slice(0, 30) : 'web',
            message: String(message).trim().slice(0, 2000),
        });

        res.status(201).json({ success: true, data: contact });
    } catch (error) {
        console.error('Contact creation error:', error);
        res.status(500).json({ message: 'Failed to submit contact message', error: error.message });
    }
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private/Admin
const getContacts = async (req, res) => {
    const contacts = await Contact.find({});
    res.json(contacts);
};

export { createContact, getContacts };
