import Tip from '../models/Tip.js';

// @desc    Fetch all tips
// @route   GET /api/tips
// @access  Public
const getTips = async (req, res) => {
    const tips = await Tip.find({});
    res.json(tips);
};

// @desc    Fetch single tip
// @route   GET /api/tips/:id
// @access  Public
const getTipById = async (req, res) => {
    const tip = await Tip.findById(req.params.id);

    if (tip) {
        res.json(tip);
    } else {
        res.status(404);
        throw new Error('Tip not found');
    }
};

// @desc    Delete a tip
// @route   DELETE /api/tips/:id
// @access  Private/Admin
const deleteTip = async (req, res) => {
    const tip = await Tip.findById(req.params.id);

    if (tip) {
        await tip.deleteOne();
        res.json({ message: 'Tip removed' });
    } else {
        res.status(404);
        throw new Error('Tip not found');
    }
};

// @desc    Create a tip
// @route   POST /api/tips
// @access  Private/Admin
const createTip = async (req, res) => {
    const tip = new Tip({
        title: 'New Ayurvedic Tip',
        description: 'Description of the tip',
        image: '/images/sample.jpg',
        category: 'Wellness',
    });

    const createdTip = await tip.save();
    res.status(201).json(createdTip);
};

// @desc    Update a tip
// @route   PUT /api/tips/:id
// @access  Private/Admin
const updateTip = async (req, res) => {
    const { title, description, image, category } = req.body;

    const tip = await Tip.findById(req.params.id);

    if (tip) {
        tip.title = title;
        tip.description = description;
        tip.image = image;
        tip.category = category;

        const updatedTip = await tip.save();
        res.json(updatedTip);
    } else {
        res.status(404);
        throw new Error('Tip not found');
    }
};

export { getTips, getTipById, deleteTip, createTip, updateTip };
