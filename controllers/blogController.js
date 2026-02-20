import Blog from '../models/Blog.js';

// @desc    Get all published blogs with pagination, search, and filtering
// @route   GET /api/blogs?page=1&limit=12&search=title&category=wellness&sort=-createdAt
// @access  Public
const getBlogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 12, search, category, tag } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const pageSize = parseInt(limit, 10) || 12;

        // Build filter object - handle both old and new blogs
        const filter = { $or: [{ status: 'published' }, { status: { $exists: false } }] };

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } },
            ];
        }

        if (category) {
            filter.category = category;
        }

        if (tag) {
            filter.tags = tag;
        }

        // Count total documents
        const total = await Blog.countDocuments(filter);
        const pages = Math.ceil(total / pageSize);

        // Fetch blogs with pagination
        const blogs = await Blog.find(filter)
            .select('-content') // Exclude full content from list view
            .sort({ isFeatured: -1, publishedAt: -1 })
            .limit(pageSize)
            .skip((pageNum - 1) * pageSize)
            .populate('userId', 'name email')
            .lean();

        res.json({
            blogs,
            pagination: {
                currentPage: pageNum,
                totalPages: pages,
                totalBlogs: total,
                pageSize,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single blog by slug or ID
// @route   GET /api/blogs/:slugOrId
// @access  Public
const getBlogById = async (req, res, next) => {
    try {
        const { slugOrId } = req.params;

        let blog = null;

        // Try to find by slug first (if slugOrId looks like a slug)
        if (slugOrId && !slugOrId.match(/^[a-f\d]{24}$/i)) {
            blog = await Blog.findOne({ slug: slugOrId }).populate('userId', 'name email avatar');
        }

        // If not found by slug, try by ID
        if (!blog) {
            blog = await Blog.findById(slugOrId).populate('userId', 'name email avatar');
        }

        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        // Increment view count
        if (blog.views) {
            blog.views = blog.views + 1;
        } else {
            blog.views = 1;
        }
        await blog.save();

        res.json(blog);
    } catch (error) {
        next(error);
    }
};

// @desc    Get related blogs based on category and tags
// @route   GET /api/blogs/:id/related
// @access  Public
const getRelatedBlogs = async (req, res, next) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 3;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        const relatedBlogs = await Blog.find({
            _id: { $ne: id },
            status: 'published',
            $or: [{ category: blog.category }, { tags: { $in: blog.tags } }],
        })
            .select('-content')
            .sort({ publishedAt: -1 })
            .limit(limit)
            .lean();

        res.json(relatedBlogs);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all blogs (admin - includes drafts)
// @route   GET /api/blogs/admin/all
// @access  Private/Admin
const getAllBlogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const pageSize = parseInt(limit, 10) || 20;

        const filter = {};

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
            ];
        }

        if (status) {
            filter.status = status;
        }

        const total = await Blog.countDocuments(filter);
        const pages = Math.ceil(total / pageSize);

        const blogs = await Blog.find(filter)
            .select('-content')
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip((pageNum - 1) * pageSize)
            .populate('userId', 'name email')
            .lean();

        res.json({
            blogs,
            pagination: {
                currentPage: pageNum,
                totalPages: pages,
                totalBlogs: total,
                pageSize,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a blog (admin)
// @route   POST /api/blogs
// @access  Private/Admin
const createBlog = async (req, res, next) => {
    try {
        const {
            title,
            shortDescription,
            content,
            excerpt,
            image,
            category,
            tags,
            author,
            authorImage,
            metaTitle,
            metaDescription,
            readTime,
            status,
        } = req.body;

        // Validation - require minimum fields
        if (!title || !content || !image || !category || !author) {
            return res.status(400).json({
                message: 'Please provide title, content, image, category, and author',
            });
        }

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

        // Check if slug already exists
        const existingBlog = await Blog.findOne({ slug });
        if (existingBlog) {
            return res.status(400).json({
                message: 'A blog with this title already exists. Please use a different title.',
            });
        }

        const blog = new Blog({
            title,
            slug,
            shortDescription: shortDescription || excerpt || content.substring(0, 200),
            content,
            excerpt: excerpt || (shortDescription || content).substring(0, 300),
            image,
            category,
            tags: tags || [],
            author,
            authorImage: authorImage || 'https://via.placeholder.com/150',
            metaTitle: metaTitle || title.substring(0, 60),
            metaDescription: metaDescription || (shortDescription || excerpt || content).substring(0, 160),
            readTime: readTime || '5 min read',
            status: status || 'draft',
            userId: req.user._id,
        });

        const createdBlog = await blog.save();

        res.status(201).json(createdBlog);
    } catch (error) {
        next(error);
    }
};

// @desc    Update a blog (admin)
// @route   PUT /api/blogs/:id
// @access  Private/Admin
const updateBlog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            title,
            slug,
            shortDescription,
            content,
            excerpt,
            image,
            category,
            tags,
            author,
            authorImage,
            metaTitle,
            metaDescription,
            readTime,
            status,
            isFeatured,
        } = req.body;

        const blog = await Blog.findById(id);

        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        // Update fields
        if (title) {
            blog.title = title;
            // Auto-regenerate slug if title changed and slug not explicitly provided
            if (!slug) {
                blog.slug = title
                    .toLowerCase()
                    .trim()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-');
            }
        }
        if (slug) blog.slug = slug;
        if (shortDescription) blog.shortDescription = shortDescription;
        if (content) blog.content = content;
        if (excerpt) blog.excerpt = excerpt;
        if (image) blog.image = image;
        if (category) blog.category = category;
        if (tags) blog.tags = tags;
        if (author) blog.author = author;
        if (authorImage) blog.authorImage = authorImage;
        if (metaTitle) blog.metaTitle = metaTitle;
        if (metaDescription) blog.metaDescription = metaDescription;
        if (readTime) blog.readTime = readTime;
        if (status) blog.status = status;
        if (isFeatured !== undefined) blog.isFeatured = isFeatured;

        const updatedBlog = await blog.save();
        res.json(updatedBlog);
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle blog publish status
// @route   PUT /api/blogs/:id/toggle-status
// @access  Private/Admin
const toggleBlogStatus = async (req, res, next) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        blog.status = blog.status === 'published' ? 'draft' : 'published';
        const updatedBlog = await blog.save();

        res.json(updatedBlog);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a blog (admin)
// @route   DELETE /api/blogs/:id
// @access  Private/Admin
const deleteBlog = async (req, res, next) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);

        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        await Blog.findByIdAndDelete(id);
        res.json({ message: 'Blog deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get blog categories
// @route   GET /api/blogs/categories
// @access  Public
const getCategories = async (req, res, next) => {
    try {
        const categories = [
            'Skin Care',
            'Hair Health',
            'Nutrition',
            'Yoga',
            'Stress Management',
            'General Wellness',
            'Ayurveda',
            'Tips & Tricks',
            'Product Guide',
            'Other',
        ];

        // Get count of blogs in each category
        const categoriesWithCount = await Promise.all(
            categories.map(async (cat) => {
                const count = await Blog.countDocuments({
                    category: cat,
                    status: 'published',
                });
                return { name: cat, count };
            })
        );

        res.json(categoriesWithCount);
    } catch (error) {
        next(error);
    }
};

export {
    getBlogs,
    getBlogById,
    getRelatedBlogs,
    getAllBlogs,
    createBlog,
    updateBlog,
    toggleBlogStatus,
    deleteBlog,
    getCategories,
};
