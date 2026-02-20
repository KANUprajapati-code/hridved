import mongoose from 'mongoose';
import Blog from '../models/Blog.js';
import dotenv from 'dotenv';

dotenv.config();

const generateSlug = (title) => {
    if (!title) return '';
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

const migrateBlogSchema = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const blogs = await Blog.find({});
        console.log(`📊 Found ${blogs.length} blogs to migrate\n`);

        let updatedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < blogs.length; i++) {
            const blog = blogs[i];
            let updated = false;

            try {
                // Generate slug from title if missing
                if (!blog.slug && blog.title) {
                    blog.slug = generateSlug(blog.title);
                    updated = true;
                }

                // Set shortDescription from excerpt or content if missing
                if (!blog.shortDescription) {
                    if (blog.excerpt) {
                        blog.shortDescription = blog.excerpt.substring(0, 500);
                    } else if (blog.content) {
                        blog.shortDescription = blog.content.substring(0, 200);
                    } else {
                        blog.shortDescription = 'No description provided';
                    }
                    updated = true;
                }

                // Auto-generate metaTitle if missing
                if (!blog.metaTitle && blog.title) {
                    blog.metaTitle = blog.title.substring(0, 60);
                    updated = true;
                }

                // Auto-generate metaDescription if missing
                if (!blog.metaDescription && blog.shortDescription) {
                    blog.metaDescription = blog.shortDescription.substring(0, 160);
                    updated = true;
                }

                // Set default status if missing
                if (!blog.status) {
                    blog.status = 'published';
                    updated = true;
                }

                // Initialize tags if missing
                if (!blog.tags) {
                    blog.tags = [];
                    updated = true;
                }

                // Initialize isFeatured if missing
                if (blog.isFeatured === undefined || blog.isFeatured === null) {
                    blog.isFeatured = false;
                    updated = true;
                }

                // Initialize views if missing
                if (blog.views === undefined || blog.views === null) {
                    blog.views = 0;
                    updated = true;
                }

                if (updated) {
                    await blog.save();
                    updatedCount++;
                    console.log(`✅ [${i + 1}/${blogs.length}] Migrated: "${blog.title.substring(0, 50)}..."`);
                } else {
                    console.log(`⏭️  [${i + 1}/${blogs.length}] Already migrated: "${blog.title.substring(0, 50)}..."`);
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ [${i + 1}/${blogs.length}] Error migrating "${blog.title}":`, error.message);
            }
        }

        console.log('\n📋 Migration Summary:');
        console.log(`   ✅ Updated: ${updatedCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📊 Total: ${blogs.length}\n`);

        if (errorCount === 0) {
            console.log('🎉 Migration completed successfully!');
        } else {
            console.log('⚠️  Migration completed with some errors. Please review above.');
        }

        process.exit(0);
    } catch (error) {
        console.error('💥 Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
};

migrateBlogSchema();
