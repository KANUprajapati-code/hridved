import About from '../models/aboutModel.js';

// @desc    Get about page data
// @route   GET /api/about
// @access  Public
const getAbout = async (req, res) => {
    let about = await About.findOne();

    if (!about) {
        // Create default if not exists
        about = await About.create({});
    }

    res.json(about);
};

// @desc    Update about page data
// @route   PUT /api/about
// @access  Private/Admin
const updateAbout = async (req, res) => {
    const about = await About.findOne();

    if (about) {
        about.heroTitle = req.body.heroTitle || about.heroTitle;
        about.heroDescription = req.body.heroDescription || about.heroDescription;
        about.heroImage = req.body.heroImage || about.heroImage;
        about.ourStoryTitle = req.body.ourStoryTitle || about.ourStoryTitle;
        about.ourStoryDescription = req.body.ourStoryDescription || about.ourStoryDescription;
        about.foundedYear = req.body.foundedYear || about.foundedYear;
        about.experiseCount = req.body.experiseCount || about.experiseCount;
        about.healedCount = req.body.healedCount || about.healedCount;
        about.missionTitle = req.body.missionTitle || about.missionTitle;
        about.missionDescription = req.body.missionDescription || about.missionDescription;
        about.visionTitle = req.body.visionTitle || about.visionTitle;
        about.visionDescription = req.body.visionDescription || about.visionDescription;
        about.values = req.body.values || about.values;
        about.teamImage1 = req.body.teamImage1 || about.teamImage1;
        about.teamImage2 = req.body.teamImage2 || about.teamImage2;
        about.teamImage3 = req.body.teamImage3 || about.teamImage3;
        about.teamImage4 = req.body.teamImage4 || about.teamImage4;

        const updatedAbout = await about.save();
        res.json(updatedAbout);
    } else {
        // Should not happen if getAbout creates default, but for safety
        const newAbout = await About.create(req.body);
        res.status(201).json(newAbout);
    }
};

export { getAbout, updateAbout };
