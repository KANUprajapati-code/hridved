import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Blog from './models/Blog.js';
import connectDB from './config/db.js';

dotenv.config();

const blogs = [
    {
        title: "Understanding Your Prakriti: The Key to Radiant Skin",
        content: "Discover how your unique Dosha—Vata, Pitta, or Kapha—influences your skin health and which Ayurvedic herbs can bring back your natural glow. Ayurveda views skin health as a reflection of your internal balance. By understanding your dominant Dosha, you can tailor your skincare routine to address specific needs. Vata skin tends to be dry and improved by hydration. Pitta skin is sensitive and benefits from cooling herbs. Kapha skin is oily and needs detoxification.",
        author: "Dr. Anjali Nair",
        category: "Skin Care",
        readTime: "8 min read",
        image: "https://images.unsplash.com/photo-1606904825846-647eb07f5be3?q=80&w=1000&auto=format&fit=crop",
        authorImage: "https://randomuser.me/api/portraits/women/44.jpg",
        isFeatured: true,
        excerpt: "Discover how your unique Dosha—Vata, Pitta, or Kapha—influences your skin health and which Ayurvedic herbs can bring back your natural glow."
    },
    {
        title: "The Power of Turmeric: Beyond the Kitchen Spice",
        content: "Exploring the scientific backing of Curcumin and how ancient Ayurvedic formulations optimize its absorption for immunity and inflammation. Turmeric is more than just a yellow spice; it's a potent anti-inflammatory agent. However, its bioavailability is low. Ayurveda suggests consuming it with black pepper or fat (like ghee) to enhance absorption.",
        author: "Vaidya Rajesh Kumar",
        category: "Nutrition",
        readTime: "6 min read",
        image: "https://images.unsplash.com/photo-1615485925694-a035aa002d1b?q=80&w=1000&auto=format&fit=crop",
        authorImage: "https://randomuser.me/api/portraits/men/32.jpg",
        isFeatured: false,
        excerpt: "Exploring the scientific backing of Curcumin and how ancient Ayurvedic formulations optimize its absorption for immunity."
    },
    {
        title: "Ritucharya: Seasonal Eating for Optimal Digestion",
        content: "How to align your diet with the changing seasons to maintain Agni (digestive fire) and prevent common seasonal ailments. In Ayurveda, the seasons have a profound impact on our bodies. Adapting your diet to the current season helps balance the Doshas and strengthens the immune system.",
        author: "Meera Iyer",
        category: "Diet & Nutrition",
        readTime: "10 min read",
        image: "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1000&auto=format&fit=crop",
        authorImage: "https://randomuser.me/api/portraits/women/68.jpg",
        isFeatured: false,
        excerpt: "How to align your diet with the changing seasons to maintain Agni (digestive fire) and prevent common seasonal ailments."
    },
    {
        title: "5 Ancient Herbs for Premature Greying and Hair Fall",
        content: "Brahmi, Bhringraj, and Amla are more than just ingredients; they are legends in hair rejuvenation. Learn how to use them effectively for lush, strong hair. Hair health is closely linked to bone health in Ayurveda. Using oils infused with these herbs can nourish the scalp and strengthen hair roots.",
        author: "Dr. Anjali Nair",
        category: "Hair Care",
        readTime: "7 min read",
        image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?q=80&w=1000&auto=format&fit=crop",
        authorImage: "https://randomuser.me/api/portraits/women/44.jpg",
        isFeatured: false,
        excerpt: "Brahmi, Bhringraj, and Amla are more than just ingredients; they are legends in hair rejuvenation."
    },
    {
        title: "Abhyanga: The Art of Ayurvedic Self-Massage",
        content: "A step-by-step guide to the ritual of self-oiling that calms the nervous system and improves lymphatic drainage. Daily self-massage with warm oil is one of the most powerful Ayurvedic practices for longevity and well-being.",
        author: "Vaidya Rajesh Kumar",
        category: "Mental Wellness",
        readTime: "12 min read",
        image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1000&auto=format&fit=crop",
        authorImage: "https://randomuser.me/api/portraits/men/32.jpg",
        isFeatured: false,
        excerpt: "A step-by-step guide to the ritual of self-oiling that calms the nervous system and improves lymphatic drainage."
    },
    {
        title: "Asanas to Balance Your Dosha During Monsoon",
        content: "Specific yoga postures that counteract the damp, cold qualities of Vata season and keep your joints flexible and energy flow stable. Yoga and Ayurveda are sister sciences. Practicing the right asanas can help balance your Doshas.",
        author: "Siddharth Varma",
        category: "Yoga",
        readTime: "9 min read",
        image: "https://images.unsplash.com/photo-1575052814088-6c9e6a397a80?q=80&w=1000&auto=format&fit=crop",
        authorImage: "https://randomuser.me/api/portraits/men/54.jpg",
        isFeatured: false,
        excerpt: "Specific yoga postures that counteract the damp, cold qualities of Vata season and keep your joints flexible."
    }
];

const seedBlogs = async () => {
    try {
        await connectDB();
        console.log("Connected to DB, clearing blogs...");
        await Blog.deleteMany();
        console.log("Blogs cleared. Inserting new blogs...");
        for (const blogData of blogs) {
            const blog = new Blog({
                ...blogData,
                shortDescription: blogData.excerpt // Use excerpt as shortDescription for seed data
            });
            await blog.save();
        }
        const createdBlogs = await Blog.find({});
        console.log(`Data Imported! Count: ${createdBlogs.length}`);
        process.exit();
    } catch (error) {
        console.error("Error importing data:", JSON.stringify(error.errors, null, 2));
        process.exit(1);
    }
};

seedBlogs();
