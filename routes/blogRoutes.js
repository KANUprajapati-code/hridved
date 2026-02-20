import express from 'express';
import {
    getBlogs,
    getBlogById,
    getRelatedBlogs,
    getAllBlogs,
    createBlog,
    updateBlog,
    toggleBlogStatus,
    deleteBlog,
    getCategories,
} from '../controllers/blogController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Specific routes MUST come before parameter routes
router.get('/categories', getCategories);
router.get('/admin/all', protect, admin, getAllBlogs); // Get all blogs including drafts

// Public routes
router.get('/', getBlogs); // Get published blogs with pagination and filters
router.get('/:slugOrId', getBlogById); // Get single blog by slug or ID
router.get('/:id/related', getRelatedBlogs); // Get related blogs

// Admin routes (protected)
router.post('/', protect, admin, createBlog); // Create new blog
router.put('/:id', protect, admin, updateBlog); // Update blog
router.put('/:id/toggle-status', protect, admin, toggleBlogStatus); // Toggle publish status
router.delete('/:id', protect, admin, deleteBlog); // Delete blog

export default router;
