import path from 'path';
import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// Cloudinary Storage for Images
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hridved_uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'],
        public_id: (req, file) => {
            const fileName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
            return `${fileName}-${Date.now()}`;
        },
    },
});

// Cloudinary Storage for Videos
const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hridved_uploads',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm', 'mkv', 'avi'],
        public_id: (req, file) => {
            const fileName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
            return `${fileName}-${Date.now()}`;
        },
    },
});

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.get('/', (req, res) => {
    res.send('Upload route is working (Cloudinary storage)');
});

// Single image upload
router.post('/', (req, res) => {
    uploadImage.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Image Error:', err);
            return res.status(400).send(`Multer upload error: ${err.message}`);
        } else if (err) {
            console.error('Image Upload Error:', err);
            return res.status(500).send(`Upload error: ${err.message}`);
        }

        if (req.file) {
            const fileUrl = req.file.path || req.file.secure_url || req.file.url;
            console.log('Image upload success:', fileUrl);
            res.send(fileUrl);
        } else {
            console.error('Upload failed: No file received');
            res.status(400).send('No image uploaded');
        }
    });
});

// Video upload
router.post('/video', (req, res) => {
    uploadVideo.single('video')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Video Error:', err);
            return res.status(400).send(`Multer video error: ${err.message}`);
        } else if (err) {
            console.error('Video Upload Error:', err);
            return res.status(500).send(`Upload error: ${err.message}`);
        }

        if (req.file) {
            const fileUrl = req.file.path || req.file.secure_url || req.file.url;
            console.log('Video upload success:', fileUrl);
            res.send(fileUrl);
        } else {
            console.error('Video Upload failed: No file received');
            res.status(400).send('No video uploaded');
        }
    });
});

// Multiple images upload
router.post('/multiple', (req, res) => {
    uploadImage.array('images', 8)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Multiple Error:', err);
            return res.status(400).send(`Multer upload error: ${err.message}`);
        } else if (err) {
            console.error('Multiple Upload Error:', err);
            return res.status(500).send(`Upload error: ${err.message}`);
        }

        if (req.files && req.files.length > 0) {
            const filePaths = req.files.map(file => file.path || file.secure_url || file.url);
            console.log('Multiple upload success:', filePaths);
            res.send(filePaths);
        } else {
            res.status(400).send('No images uploaded');
        }
    });
});

export default router;
