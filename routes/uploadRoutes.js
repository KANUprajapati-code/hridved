
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

router.post('/', upload.single('image'), (req, res) => {
    if (req.file) {
        res.send(req.file.path);
    } else {
        res.status(400).send('No image uploaded');
    }
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
