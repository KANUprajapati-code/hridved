import Concern from '../models/Concern.js';
import Product from '../models/Product.js';

// @desc    Get all active concerns
// @route   GET /api/concerns
// @access  Public
const getConcerns = async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200');
    const concerns = await Concern.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
    res.json(concerns);
};

// @desc    Get single concern by slug with associated products
// @route   GET /api/concerns/:slug
// @access  Public
const getConcernBySlug = async (req, res) => {
    const concern = await Concern.findOne({ slug: req.params.slug, isActive: true }).lean();
    if (!concern) {
        return res.status(404).json({ message: 'Concern not found' });
    }

    const products = await Product.find({
        $or: [
            { concern: concern.name },
            { concerns: concern.name },
            { category: concern.category }
        ]
    })
    .select('name price mrp image isBestseller countInStock rating numReviews category concern concerns isFeatured')
    .lean();

    res.json({ concern, products });
};

// @desc    Create a concern
// @route   POST /api/concerns
// @access  Private/Admin
const createConcern = async (req, res) => {
    const { name, slug, category, description, badge, image, isActive, order } = req.body;

    const exists = await Concern.findOne({ $or: [{ name }, { slug }] });
    if (exists) {
        return res.status(400).json({ message: 'Concern with this name or slug already exists' });
    }

    const concern = await Concern.create({
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        category,
        description,
        badge: badge || 'Classical Ayurveda',
        image: image || '',
        isActive: isActive !== undefined ? isActive : true,
        order: Number(order) || 0
    });

    res.status(201).json(concern);
};

// @desc    Update a concern
// @route   PUT /api/concerns/:id
// @access  Private/Admin
const updateConcern = async (req, res) => {
    const concern = await Concern.findById(req.params.id);
    if (!concern) {
        return res.status(404).json({ message: 'Concern not found' });
    }

    concern.name = req.body.name || concern.name;
    concern.slug = req.body.slug || concern.slug;
    concern.category = req.body.category || concern.category;
    concern.description = req.body.description || concern.description;
    concern.badge = req.body.badge !== undefined ? req.body.badge : concern.badge;
    concern.image = req.body.image !== undefined ? req.body.image : concern.image;
    concern.isActive = req.body.isActive !== undefined ? req.body.isActive : concern.isActive;
    concern.order = req.body.order !== undefined ? req.body.order : concern.order;

    const updated = await concern.save();
    res.json(updated);
};

// @desc    Delete a concern
// @route   DELETE /api/concerns/:id
// @access  Private/Admin
const deleteConcern = async (req, res) => {
    const concern = await Concern.findById(req.params.id);
    if (!concern) {
        return res.status(404).json({ message: 'Concern not found' });
    }

    await concern.deleteOne();
    res.json({ message: 'Concern removed' });
};

export { getConcerns, getConcernBySlug, createConcern, updateConcern, deleteConcern };

