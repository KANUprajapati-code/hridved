
import Product from '../models/Product.js';

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    const isBestseller = req.query.isBestseller === 'true';
    const pageSize = isBestseller ? 50 : (Number(req.query.pageSize) || 12);
    const page = Number(req.query.pageNumber) || 1;

    const andConditions = [];

    if (req.query.keyword) {
        const queryTerm = req.query.keyword.trim();
        const searchRegex = { $regex: queryTerm, $options: 'i' };
        andConditions.push({
            $or: [
                { name: searchRegex },
                { sku: searchRegex },
                { category: searchRegex },
                { concern: searchRegex },
                { concerns: searchRegex },
                { description: searchRegex },
                { ingredients: searchRegex },
                { keyIngredients: searchRegex },
                { benefits: searchRegex }
            ]
        });
    }

    if (req.query.category) {
        const categories = req.query.category.split(',');
        andConditions.push({ category: { $in: categories } });
    }

    if (req.query.concern) {
        const concerns = req.query.concern.split(',');
        andConditions.push({
            $or: [
                { concerns: { $in: concerns } },
                { concern: { $in: concerns } }
            ]
        });
    }

    // Price filtering
    if (req.query.minPrice || req.query.maxPrice) {
        const priceFilter = {};
        if (req.query.minPrice) priceFilter.$gte = Number(req.query.minPrice);
        if (req.query.maxPrice) priceFilter.$lte = Number(req.query.maxPrice);
        andConditions.push({ price: priceFilter });
    }

    // In-Stock only filter
    if (req.query.inStock === 'true') {
        andConditions.push({ countInStock: { $gt: 0 } });
    }

    // Rating filter (min rating)
    if (req.query.rating) {
        andConditions.push({ rating: { $gte: Number(req.query.rating) } });
    }

    if (isBestseller) {
        andConditions.push({ isBestseller: true });
    }

    const keyword = andConditions.length > 0 ? { $and: andConditions } : {};

    // Sorting
    let sort = {};
    if (req.query.sort === 'price-asc') {
        sort = { price: 1 };
    } else if (req.query.sort === 'price-desc') {
        sort = { price: -1 };
    } else if (req.query.sort === 'newest') {
        sort = { createdAt: -1 };
    } else if (req.query.sort === 'rating') {
        sort = { rating: -1 };
    } else if (req.query.sort === 'featured') {
        sort = { isFeatured: -1, isBestseller: -1, createdAt: -1 };
    } else {
        sort = { createdAt: -1 };
    }

    const [count, products] = await Promise.all([
        Product.countDocuments(keyword),
        Product.find(keyword)
            .select('name price mrp image isBestseller countInStock rating numReviews category concern concerns isFeatured packSize sku')
            .sort(sort)
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .lean()
    ]);

    // Edge CDN & browser caching: Ultra-fast repeat loads & instant CDN caching
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

    res.json({ products, page, pages: Math.ceil(count / pageSize), count });
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        res.json(product);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    const product = new Product({
        name: 'Sample name',
        price: 0,
        mrp: 0,
        user: req.user._id,
        image: '/images/sample.jpg',
        category: 'Sample category',
        countInStock: 0,
        numReviews: 0,
        description: 'Sample description',
        brand: 'Sample brand',
        benefits: 'Sample benefits',
        howToUse: 'Sample how to use',
        gst: 0,
        weight: 0.5,
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    const {
        name,
        price,
        mrp,
        sku,
        packSize,
        description,
        image,
        images,
        category,
        concern,
        concerns,
        countInStock,
        isBestseller,
        isFeatured,
        brand,
        ingredients,
        keyIngredients,
        benefits,
        howToUse,
        precautions,
        storage,
        manufacturerDetails,
        verifiedDocuments,
        faqs,
        claimStatus,
        evidenceReference,
        childAgeGuidance,
        variants,
        gst,
        weight,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
        if (name !== undefined) product.name = name;
        if (price !== undefined) product.price = price;
        if (mrp !== undefined) product.mrp = mrp;
        if (sku !== undefined) product.sku = sku;
        if (packSize !== undefined) product.packSize = packSize;
        if (description !== undefined) product.description = description;
        if (image !== undefined) product.image = image;
        if (images !== undefined) product.images = images;
        if (category !== undefined) product.category = category;
        if (concern !== undefined) product.concern = concern;
        if (concerns !== undefined) product.concerns = concerns;
        if (countInStock !== undefined) product.countInStock = countInStock;
        if (isBestseller !== undefined) product.isBestseller = isBestseller;
        if (isFeatured !== undefined) product.isFeatured = isFeatured;
        if (brand !== undefined) product.brand = brand;
        if (ingredients !== undefined) product.ingredients = ingredients;
        if (keyIngredients !== undefined) product.keyIngredients = keyIngredients;
        if (benefits !== undefined) product.benefits = benefits;
        if (howToUse !== undefined) product.howToUse = howToUse;
        if (precautions !== undefined) product.precautions = precautions;
        if (storage !== undefined) product.storage = storage;
        if (manufacturerDetails !== undefined) product.manufacturerDetails = manufacturerDetails;
        if (verifiedDocuments !== undefined) product.verifiedDocuments = verifiedDocuments;
        if (faqs !== undefined) product.faqs = faqs;
        if (claimStatus !== undefined) product.claimStatus = claimStatus;
        if (evidenceReference !== undefined) product.evidenceReference = evidenceReference;
        if (childAgeGuidance !== undefined) product.childAgeGuidance = childAgeGuidance;
        if (variants !== undefined) product.variants = variants;
        if (gst !== undefined) product.gst = gst;
        if (weight !== undefined) product.weight = weight;

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
        const alreadyReviewed = product.reviews.find(
            (r) => r.user.toString() === req.user._id.toString()
        );

        if (alreadyReviewed) {
            res.status(400);
            throw new Error('Product already reviewed');
        }

        const review = {
            name: req.user.name,
            rating: Number(rating),
            comment,
            user: req.user._id,
        };

        product.reviews.push(review);
        product.numReviews = product.reviews.length;
        product.rating =
            product.reviews.reduce((acc, item) => item.rating + acc, 0) /
            product.reviews.length;

        await product.save();
        res.status(201).json({ message: 'Review added' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
};

// @desc    Get autocomplete search suggestions
// @route   GET /api/products/search/suggestions?q=...
// @access  Public
const getSearchSuggestions = async (req, res) => {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
        return res.json({ products: [], categories: [], concerns: [], ingredients: [] });
    }

    const regex = new RegExp(q, 'i');

    const [products, matchingCategories] = await Promise.all([
        Product.find({
            $or: [
                { name: regex },
                { sku: regex },
                { category: regex },
                { concern: regex },
                { ingredients: regex },
                { keyIngredients: regex }
            ]
        })
        .select('name image price mrp packSize category sku countInStock rating numReviews')
        .limit(6)
        .lean(),

        Product.distinct('category', { category: regex })
    ]);

    // Classical Ayurvedic ingredients catalog for suggestions
    const approvedIngredients = [
        '24K Swarna Bhasma',
        'Medhya Brahmi',
        'Shankhpushpi',
        'Vacha',
        'Desi Cow Ghee',
        'A2 Bilona Ghee',
        'Kashmiri Saffron (Kesar)',
        'Rosemary Essential Oil',
        'Kumkumadi Tailam',
        'Raktachandana (Red Sandalwood)',
        'Lodhra',
        'Manjistha',
        'Nirgundi (Joint Care)',
        'Mahanarayan Tailam'
    ];

    const matchingIngredients = approvedIngredients.filter(ing => 
        ing.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 4);

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=180, stale-while-revalidate=300');
    res.json({
        products,
        categories: matchingCategories.slice(0, 4),
        ingredients: matchingIngredients
    });
};

export {
    getProducts,
    getProductById,
    deleteProduct,
    createProduct,
    updateProduct,
    createProductReview,
    getSearchSuggestions,
};
