
import Content from '../models/Content.js';

// @desc    Get all content
// @route   GET /api/content
// @access  Public
const getContent = async (req, res) => {
    const content = await Content.find({});
    // Convert array to object for easier frontend access: { hero: {...}, tradition: {...} }
    const contentMap = content.reduce((acc, item) => {
        acc[item.section] = item;
        return acc;
    }, {});
    res.json(contentMap);
};

// @desc    Update content section
// @route   PUT /api/content/:section
// @access  Private/Admin
const updateContent = async (req, res) => {
    const { section } = req.params;
    const { title, subtitle, image, ctaText, ctaLink, items } = req.body;

    let content = await Content.findOne({ section });

    if (content) {
        content.title = title || content.title;
        content.subtitle = subtitle || content.subtitle;
        content.image = image || content.image;
        content.ctaText = ctaText || content.ctaText;
        content.ctaLink = ctaLink || content.ctaLink;
        content.items = items || content.items;

        const updatedContent = await content.save();
        res.json(updatedContent);
    } else {
        // Create if not exists
        const newContent = new Content({
            section,
            title,
            subtitle,
            image,
            ctaText,
            ctaLink,
            items
        });
        const createdContent = await newContent.save();
        res.json(createdContent);
    }
};

export { getContent, updateContent };
