
import path from 'path';
import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hridved_uploads',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        public_id: (req, file) => {
            const fileName = path.parse(file.originalname).name;
            return `${fileName}-${Date.now()}`;
        },
    },
});

const upload = multer({ storage });

const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hridved_uploads',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm', 'mkv'],
        public_id: (req, file) => {
            const fileName = path.parse(file.originalname).name;
            return `${fileName}-${Date.now()}`;
        },
    },
});

const uploadVideo = multer({ storage: videoStorage });

router.get('/', (req, res) => {
    res.send('Upload route is working');
});

router.post('/', (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).send(`Multer upload error: ${err.message}`);
        } else if (err) {
            console.error('Unknown Upload Error:', err);
            return res.status(500).send(`Unknown upload error: ${err.message}`);
        }

        if (req.file) {
            console.log('Upload success:', req.file.path);
            res.send(req.file.path);
        } else {
            console.error('Upload failed: No file received');
            res.status(400).send('No image uploaded');
        }
    });
});

router.post('/video', (req, res, next) => {
    uploadVideo.single('video')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).send(`Multer upload error: ${err.message}`);
        } else if (err) {
            console.error('Unknown Upload Error:', err);
            return res.status(500).send(`Unknown upload error: ${err.message}`);
        }

        if (req.file) {
            console.log('Video Upload success:', req.file.path);
            res.send(req.file.path);
        } else {
            console.error('Video Upload failed: No file received');
            res.status(400).send('No video uploaded');
        }
    });
});

router.post('/multiple', upload.array('images', 5), (req, res) => {
    if (req.files) {
        const filePaths = req.files.map(file => file.path);
        res.send(filePaths);
    } else {
        res.status(400).send('No images uploaded');
    }
});

export default router;
