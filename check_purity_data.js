
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const contentSchema = mongoose.Schema({
    section: String,
    title: String,
    subtitle: String,
    image: String,
    image1: String,
    image2: String,
    ctaText: String,
    ctaLink: String,
    items: [mongoose.Schema.Types.Mixed]
});

const Content = mongoose.model('Content', contentSchema);

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const contents = await Content.find({});
        console.log('--- Content Data ---');
        contents.forEach(c => {
            console.log(`Section: ${c.section}`);
            if (c.image) console.log(`  Image: ${c.image}`);
            if (c.image1) console.log(`  Image1: ${c.image1}`);
            if (c.image2) console.log(`  Image2: ${c.image2}`);
        });
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkData();
