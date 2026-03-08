import asyncHandler from '../middleware/asyncHandler.js';
import DoctorCategory from '../models/DoctorCategory.js';

// @desc    Get all doctor categories
// @route   GET /api/doctor-categories
// @access  Public
const getDoctorCategories = asyncHandler(async (req, res) => {
    const categories = await DoctorCategory.find({});
    res.json(categories);
});

// @desc    Create a doctor category
// @route   POST /api/doctor-categories
// @access  Private/Admin
const createDoctorCategory = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const categoryExists = await DoctorCategory.findOne({ name });

    if (categoryExists) {
        res.status(400);
        throw new Error('Category already exists');
    }

    const category = await DoctorCategory.create({ name });
    res.status(201).json(category);
});

// @desc    Delete a doctor category
// @route   DELETE /api/doctor-categories/:id
// @access  Private/Admin
const deleteDoctorCategory = asyncHandler(async (req, res) => {
    const category = await DoctorCategory.findById(req.params.id);

    if (category) {
        await DoctorCategory.deleteOne({ _id: category._id });
        res.json({ message: 'Category removed' });
    } else {
        res.status(404);
        throw new Error('Category not found');
    }
});

export {
    getDoctorCategories,
    createDoctorCategory,
    deleteDoctorCategory
};
