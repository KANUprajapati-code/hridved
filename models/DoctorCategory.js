import mongoose from 'mongoose';

const doctorCategorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
});

const DoctorCategory = mongoose.model('DoctorCategory', doctorCategorySchema);

export default DoctorCategory;
