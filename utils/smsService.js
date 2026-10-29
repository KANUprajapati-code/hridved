import axios from 'axios';

/**
 * Send real OTP via SMS to Indian mobile numbers
 * Supports Fast2SMS, 2Factor.in, and Twilio.
 * 
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, message: string, simulated?: boolean, provider?: string}>}
 */
export const sendSMS = async (phone, otp) => {
    // Clean phone number (strip +91 or non-digits)
    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    const messageText = `Your Hridved verification code is ${otp}. Valid for 10 minutes. Please do not share this OTP with anyone.`;

    console.log(`[SMS-SERVICE] Initiating SMS dispatch for +91 ${cleanPhone}`);

    // 1. FAST2SMS (India's most popular OTP gateway)
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey && fast2smsKey !== 'your_fast2sms_api_key_here') {
        try {
            console.log(`[SMS-SERVICE] Attempting Fast2SMS for +91 ${cleanPhone}...`);
            const response = await axios.post(
                'https://www.fast2sms.com/dev/bulkV2',
                {
                    variables_values: otp,
                    route: 'otp',
                    numbers: cleanPhone,
                },
                {
                    headers: {
                        authorization: fast2smsKey.trim(),
                        'Content-Type': 'application/json',
                    },
                    timeout: 8000,
                }
            );

            if (response.data && (response.data.return === true || response.data.status_code === 200)) {
                console.log(`[SMS-SERVICE] Fast2SMS dispatch successful for +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'OTP delivered to your mobile phone via SMS',
                    provider: 'Fast2SMS',
                };
            } else {
                console.warn('[SMS-SERVICE] Fast2SMS response:', response.data);
            }
        } catch (error) {
            console.error('[SMS-SERVICE] Fast2SMS Error:', error.response?.data || error.message);
        }
    }

    // 2. 2FACTOR.IN (High-priority Indian Transactional OTP)
    const twoFactorKey = process.env.TWOFACTOR_API_KEY;
    if (twoFactorKey && twoFactorKey !== 'your_2factor_api_key_here') {
        try {
            console.log(`[SMS-SERVICE] Attempting 2Factor.in for +91 ${cleanPhone}...`);
            const url = `https://2factor.in/API/V1/${encodeURIComponent(twoFactorKey.trim())}/SMS/${cleanPhone}/${otp}/`;
            const response = await axios.get(url, { timeout: 8000 });

            if (response.data && response.data.Status === 'Success') {
                console.log(`[SMS-SERVICE] 2Factor.in dispatch successful for +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'OTP delivered to your mobile phone via SMS',
                    provider: '2Factor',
                };
            }
        } catch (error) {
            console.error('[SMS-SERVICE] 2Factor Error:', error.response?.data || error.message);
        }
    }

    // 3. TWILIO (Global SMS Gateway)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
            console.log(`[SMS-SERVICE] Attempting Twilio for +91 ${cleanPhone}...`);
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            const response = await axios.post(
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
                    timeout: 8000,
                }
            );

            if (response.status === 201 || response.status === 200) {
                console.log(`[SMS-SERVICE] Twilio dispatch successful for +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'OTP delivered via Twilio SMS',
                    provider: 'Twilio',
                };
            }
        } catch (error) {
            console.error('[SMS-SERVICE] Twilio Error:', error.response?.data || error.message);
        }
    }

    // 4. Fallback: Simulated/Development Mode
    console.warn(`[SMS-SERVICE] No live SMS gateway configured in .env! OTP for ${cleanPhone} is: [${otp}]`);
    return {
        success: true,
        message: 'No live SMS gateway key in .env. OTP simulated.',
        simulated: true,
        provider: 'Simulator',
    };
};
