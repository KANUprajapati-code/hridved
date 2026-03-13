import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env is in the parent directory of hridved (root)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI not found in environment variables');
    process.exit(1);
}

async function update1921() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const Content = mongoose.connection.collection('contents');
        const About = mongoose.connection.collection('abouts');

        // Update contents
        const contents = await Content.find().toArray();
        console.log(`Checking ${contents.length} content documents...`);
        let contentUpdated = 0;
        for (const doc of contents) {
            let str = JSON.stringify(doc);
            if (str.includes('1921')) {
                console.log(`Found 1921 in content doc: ${doc._id} (Section: ${doc.section})`);
                const newStr = str.replace(/1921/g, '2020').replace(/over a century/g, 'years');
                const newDoc = JSON.parse(newStr);
                const id = newDoc._id;
                delete newDoc._id; 
                await Content.updateOne({ _id: id }, { $set: newDoc });
                contentUpdated++;
            }
        }

        // Update abouts
        const abouts = await About.find().toArray();
        console.log(`Checking ${abouts.length} about documents...`);
        let aboutUpdated = 0;
        for (const doc of abouts) {
            let str = JSON.stringify(doc);
            if (str.includes('1921')) {
                console.log(`Found 1921 in about doc: ${doc._id}`);
                const newStr = str.replace(/1921/g, '2020').replace(/over a century/g, 'years');
                const newDoc = JSON.parse(newStr);
                const id = newDoc._id;
                delete newDoc._id;
                await About.updateOne({ _id: id }, { $set: newDoc });
                aboutUpdated++;
            }
        }

        console.log(`Update complete. Updated ${contentUpdated} content docs and ${aboutUpdated} about docs.`);
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

update1921();
