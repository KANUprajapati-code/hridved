import axios from 'axios';

/**
 * Send OTP via SMS
 * @param {string} phone - 10-digit phone number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendSMS = async (phone, otp) => {
    // Clean phone number (strip +91 or any non-digit chars)
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    const messageText = `Your Hridved verification code is ${otp}. Valid for 10 minutes. Please do not share this OTP with anyone.`;

    console.log(`[OTP SERVICE] Dispatching OTP for phone: +91 ******${cleanPhone.slice(-4)}`);

    // 1. Try Fast2SMS (Indian Gateway) if configured
    if (process.env.FAST2SMS_API_KEY) {
        try {
            const response = await axios.post(
                'https://www.fast2sms.com/dev/bulkV2',
                {
                    variables_values: otp,
                    route: 'otp',
                    numbers: cleanPhone,
                },
                {
                    headers: {
                        authorization: process.env.FAST2SMS_API_KEY,
                    },
                }
            );

            if (response.data && response.data.return) {
                return { success: true, message: 'OTP sent via Fast2SMS' };
            }
        } catch (error) {
            console.error('[SMS SERVICE] Fast2SMS Error:', error.response?.data || error.message);
        }
    }

    // 2. Try Twilio if configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
                new URLSearchParams({
                    To: `+91${cleanPhone}`,
                    From: process.env.TWILIO_PHONE_NUMBER,
                    Body: messageText,
                }).toString(),
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );
            return { success: true, message: 'OTP sent via Twilio' };
        } catch (error) {
            console.error('[SMS SERVICE] Twilio Error:', error.response?.data || error.message);
        }
    }

    // 3. Simulated/Development Mode
    return {
        success: true,
        message: 'OTP simulated successfully (viewable in server logs)',
        simulated: true,
    };
};
