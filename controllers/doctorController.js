import Doctor from '../models/Doctor.js';

// @desc    Fetch all doctors
// @route   GET /api/doctors
// @access  Public
const getDoctors = async (req, res) => {
    const doctors = await Doctor.find({});
    res.json(doctors);
};

// @desc    Fetch single doctor
// @route   GET /api/doctors/:id
// @access  Public
const getDoctorById = async (req, res) => {
    const doctor = await Doctor.findById(req.params.id);

    if (doctor) {
        res.json(doctor);
    } else {
        res.status(404);
        throw new Error('Doctor not found');
    }
};

// @desc    Delete a doctor
// @route   DELETE /api/doctors/:id
// @access  Private/Admin
const deleteDoctor = async (req, res) => {
    const doctor = await Doctor.findById(req.params.id);

    if (doctor) {
        await doctor.deleteOne();
        res.json({ message: 'Doctor removed' });
    } else {
        res.status(404);
        throw new Error('Doctor not found');
    }
};

// @desc    Create a doctor
// @route   POST /api/doctors
// @access  Private/Admin
const createDoctor = async (req, res) => {
    const doctor = new Doctor({
        name: 'New Doctor',
        specialization: 'General',
        image: '/images/sample.jpg',
        experience: '0 Yrs Exp',
        patients: '0+ Patients',
        languages: ['English'],
        fee: 0,
        tags: ['General'],
        quote: 'Sample quote',
        available: true,
        isVerified: true
    });

    const createdDoctor = await doctor.save();
    res.status(201).json(createdDoctor);
};

// @desc    Update a doctor
// @route   PUT /api/doctors/:id
// @access  Private/Admin
const updateDoctor = async (req, res) => {
    const {
        name,
        specialization,
        image,
        experience,
        patients,
        languages,
        fee,
        tags,
        quote,
        available,
        isVerified
    } = req.body;

    const doctor = await Doctor.findById(req.params.id);

    if (doctor) {
        doctor.name = name;
        doctor.specialization = specialization;
        doctor.image = image;
        doctor.experience = experience;
        doctor.patients = patients;
        doctor.languages = languages;
        doctor.fee = fee;
        doctor.tags = tags;
        doctor.quote = quote;
        doctor.available = available;
        doctor.isVerified = isVerified;

        const updatedDoctor = await doctor.save();
        res.json(updatedDoctor);
    } else {
        res.status(404);
        throw new Error('Doctor not found');
    }
};

export {
    getDoctors,
    getDoctorById,
    deleteDoctor,
    createDoctor,
    updateDoctor,
};
