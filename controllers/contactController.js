
import Contact from '../models/Contact.js';

// @desc    Create new contact message
// @route   POST /api/contact
// @access  Public
const createContact = async (req, res) => {
    const { name, email, phone, message } = req.body;

    const contact = await Contact.create({
        name,
        email,
        phone,
        message,
    });

    res.status(201).json(contact);
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private/Admin
const getContacts = async (req, res) => {
    const contacts = await Contact.find({});
    res.json(contacts);
};

export { createContact, getContacts };
