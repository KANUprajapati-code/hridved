import mongoose from 'mongoose';

const blogSchema = mongoose.Schema(
    {
        // Basic Content
        title: {
            type: String,
            required: [true, 'Please provide a blog title'],
            trim: true,
            maxlength: 200,
        },
        slug: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
        },
        shortDescription: {
            type: String,
            maxlength: 500,
        },
        content: {
            type: String,
        },
        excerpt: {
            type: String,
            maxlength: 300,
        },

        // Media
        image: {
            type: String,
            required: [true, 'Please provide a featured image'],
        },

        // Author Information
        author: {
            type: String,
            required: [true, 'Please provide author name'],
        },
        authorImage: {
            type: String,
            default: 'https://via.placeholder.com/150',
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        // Categorization
        category: {
            type: String,
            required: [true, 'Please select a category'],
            enum: [
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
            ],
        },
        tags: {
            type: [String],
            default: [],
        },

        // SEO Fields
        metaTitle: {
            type: String,
            maxlength: 60,
        },
        metaDescription: {
            type: String,
            maxlength: 160,
        },

        // Reading & Engagement
        readTime: {
            type: String,
            default: '5 min read',
        },
        views: {
            type: Number,
            default: 0,
        },

        // Status & Featured
        status: {
            type: String,
            enum: ['draft', 'published'],
            default: 'draft',
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        publishedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Auto-generate missing fields before save
blogSchema.pre('save', function () {
    // Generate slug if not provided
    if (!this.slug && this.title) {
        this.slug = this.title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    // Set shortDescription from excerpt or content if not provided
    if (!this.shortDescription) {
        if (this.excerpt) {
            this.shortDescription = this.excerpt;
        } else if (this.content) {
            this.shortDescription = this.content.substring(0, 200);
        } else {
            this.shortDescription = 'No description provided';
        }
    }

    // Auto-generate metaTitle from title if not provided
    if (!this.metaTitle && this.title) {
        this.metaTitle = this.title.substring(0, 60);
    }

    // Auto-generate metaDescription from shortDescription if not provided
    if (!this.metaDescription && this.shortDescription) {
        this.metaDescription = this.shortDescription.substring(0, 160);
    }

    return;
});

// Set publishedAt when status changes to published
blogSchema.pre('save', function () {
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    return;
});

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;
