
import axios from 'axios';

const testApi = async () => {
    try {
        console.log('Testing GET http://localhost:5000/api/addresses...');
        const response = await axios.get('http://localhost:5000/api/addresses');
        console.log('Response Status:', response.status);
    } catch (error) {
        if (error.response) {
            console.log('Response Status:', error.response.status);
            console.log('Response Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

testApi();
