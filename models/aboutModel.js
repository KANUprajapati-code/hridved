import mongoose from 'mongoose';

const aboutSchema = mongoose.Schema({
    heroTitle: { type: String, required: true, default: "Our Journey" },
    heroDescription: { type: String, required: true, default: "Bridging the gap between ancient Ayurvedic wisdom and modern holistic wellness since 1921." },
    heroImage: { type: String, required: true, default: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=2040&auto=format&fit=crop" },

    ourStoryTitle: { type: String, default: "A Century of Healing" },
    ourStoryDescription: { type: String, default: "Founded in 1921..." }, // Will store HTML or long text
    foundedYear: { type: String, default: "1921" },
    experiseCount: { type: String, default: "500+" }, // Products
    healedCount: { type: String, default: "3M+" },

    missionTitle: { type: String, default: "Our Mission" },
    missionDescription: { type: String, default: "To bring the authentic..." },

    visionTitle: { type: String, default: "Our Vision" },
    visionDescription: { type: String, default: "To be the global benchmark..." },

    values: [{
        title: { type: String },
        description: { type: String },
        icon: { type: String } // store icon name string if needed, or just hardcode icons in frontend and map by index/id
    }],

    teamImage1: { type: String },
    teamImage2: { type: String },
    teamImage3: { type: String },
    teamImage4: { type: String },

}, {
    timestamps: true
});

const About = mongoose.model('About', aboutSchema);

export default About;
