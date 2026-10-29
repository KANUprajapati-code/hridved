import path from 'path';
import express from 'express';
import multer from 'multer';
import fs from 'fs';

const router = express.Router();

// Ensure local uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage for local storage without Cloudinary
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDir);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        const baseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${baseName}-${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedImageTypes = /jpg|jpeg|png|webp|svg|gif/;
    const allowedVideoTypes = /mp4|mov|webm|mkv/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    
    if (allowedImageTypes.test(ext) || allowedVideoTypes.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type .${ext} is not supported`));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter
});

router.get('/', (req, res) => {
    res.send('Upload route is working (Local MongoDB/Uploads storage)');
});

// Single image upload
router.post('/', (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).send(`Multer upload error: ${err.message}`);
        } else if (err) {
            console.error('Upload Error:', err);
            return res.status(500).send(`Upload error: ${err.message}`);
        }

        if (req.file) {
            const normalizedPath = `/${req.file.path.replace(/\\/g, '/')}`;
            console.log('Upload success:', normalizedPath);
            res.send(normalizedPath);
        } else {
            console.error('Upload failed: No file received');
            res.status(400).send('No image uploaded');
        }
    });
});

// Video upload
router.post('/video', (req, res) => {
    upload.single('video')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).send(`Multer upload error: ${err.message}`);
        } else if (err) {
            console.error('Video Upload Error:', err);
            return res.status(500).send(`Upload error: ${err.message}`);
        }

        if (req.file) {
            const normalizedPath = `/${req.file.path.replace(/\\/g, '/')}`;
            console.log('Video upload success:', normalizedPath);
            res.send(normalizedPath);
        } else {
            console.error('Video Upload failed: No file received');
            res.status(400).send('No video uploaded');
        }
    });
});

// Multiple image upload
router.post('/multiple', upload.array('images', 8), (req, res) => {
    if (req.files && req.files.length > 0) {
        const filePaths = req.files.map(file => `/${file.path.replace(/\\/g, '/')}`);
        res.send(filePaths);
    } else {
        res.status(400).send('No images uploaded');
    }
});

export default router;
