import Address from '../models/Address.js';

// @desc    Get all addresses for user
// @route   GET /api/addresses
// @access  Private
export const getUserAddresses = async (req, res) => {
    try {
        const addresses = await Address.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get address by ID
// @route   GET /api/addresses/:id
// @access  Private
export const getAddressById = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        
        // Check if address belongs to logged-in user
        if (address.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to access this address' });
        }
        
        res.json(address);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new address
// @route   POST /api/addresses
// @access  Private
export const createAddress = async (req, res) => {
    const { fullName, mobileNumber, pincode, state, city, houseNumber, landmark, addressType } = req.body;
    
    // Validation
    if (!fullName || !mobileNumber || !pincode || !state || !city || !houseNumber) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Validate pincode format (Indian pincode: 6 digits)
    if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ message: 'Pincode must be 6 digits' });
    }
    
    // Validate mobile number format (Indian mobile: 10 digits)
    if (!/^\d{10}$/.test(mobileNumber)) {
        return res.status(400).json({ message: 'Mobile number must be 10 digits' });
    }
    
    try {
        const address = new Address({
            user: req.user._id,
            fullName,
            mobileNumber,
            pincode,
            state,
            city,
            houseNumber,
            landmark: landmark || '',
            addressType: addressType || 'Home',
        });
        
        const savedAddress = await address.save();
        res.status(201).json(savedAddress);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
export const updateAddress = async (req, res) => {
    try {
        let address = await Address.findById(req.params.id);
        
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        
        // Check if address belongs to logged-in user
        if (address.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this address' });
        }
        
        const { fullName, mobileNumber, pincode, state, city, houseNumber, landmark, addressType } = req.body;
        
        // Validate if provided
        if (mobileNumber && !/^\d{10}$/.test(mobileNumber)) {
            return res.status(400).json({ message: 'Mobile number must be 10 digits' });
        }
        
        if (pincode && !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ message: 'Pincode must be 6 digits' });
        }
        
        // Update fields
        if (fullName) address.fullName = fullName;
        if (mobileNumber) address.mobileNumber = mobileNumber;
        if (pincode) address.pincode = pincode;
        if (state) address.state = state;
        if (city) address.city = city;
        if (houseNumber) address.houseNumber = houseNumber;
        if (landmark !== undefined) address.landmark = landmark;
        if (addressType) address.addressType = addressType;
        
        const updatedAddress = await address.save();
        res.json(updatedAddress);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        
        // Check if address belongs to logged-in user
        if (address.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this address' });
        }
        
        await Address.findByIdAndDelete(req.params.id);
        res.json({ message: 'Address removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Set address as default
// @route   PUT /api/addresses/:id/default
// @access  Private
export const setDefaultAddress = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        
        // Check if address belongs to logged-in user
        if (address.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this address' });
        }
        
        // Unset all other addresses as default
        await Address.updateMany(
            { user: req.user._id },
            { isDefault: false }
        );
        
        // Set this address as default
        address.isDefault = true;
        const updatedAddress = await address.save();
        res.json(updatedAddress);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
