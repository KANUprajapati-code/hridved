import Content from '../models/Content.js';

// @desc    Get all content
// @route   GET /api/content
// @access  Public
const getContent = async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200');
    const content = await Content.find({}).lean();
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
    const { title, subtitle, description, image, image1, image2, ctaText, ctaLink, isVisible, order, items } = req.body;

    let content = await Content.findOne({ section });

    if (content) {
        content.title = title !== undefined ? title : content.title;
        content.subtitle = subtitle !== undefined ? subtitle : content.subtitle;
        content.description = description !== undefined ? description : content.description;
        content.image = image !== undefined ? image : content.image;
        content.image1 = image1 !== undefined ? image1 : content.image1;
        content.image2 = image2 !== undefined ? image2 : content.image2;
        content.ctaText = ctaText !== undefined ? ctaText : content.ctaText;
        content.ctaLink = ctaLink !== undefined ? ctaLink : content.ctaLink;
        content.isVisible = isVisible !== undefined ? isVisible : content.isVisible;
        content.order = order !== undefined ? order : content.order;
        content.items = items !== undefined ? items : content.items;

        const updatedContent = await content.save();
        res.json(updatedContent);
    } else {
        // Create if not exists
        const newContent = new Content({
            section,
            title,
            subtitle,
            description,
            image,
            image1,
            image2,
            ctaText,
            ctaLink,
            isVisible: isVisible !== undefined ? isVisible : true,
            order: order !== undefined ? order : 0,
            items
        });
        const createdContent = await newContent.save();
        res.json(createdContent);
    }
};

export { getContent, updateContent };
