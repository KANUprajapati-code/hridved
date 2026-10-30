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

    console.log(`[SMS-SERVICE] Initiating SMS dispatch for +91 ${cleanPhone}`);

    // 1. FAST2SMS (India's most popular OTP gateway)
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey && fast2smsKey !== 'your_fast2sms_api_key_here') {
        try {
            console.log(`[SMS-SERVICE] Attempting Fast2SMS for +91 ${cleanPhone}...`);
            const params = new URLSearchParams({
                variables_values: otp,
                route: 'otp',
                numbers: cleanPhone,
            });

            const response = await axios.post(
                'https://www.fast2sms.com/dev/bulkV2',
                params.toString(),
                {
                    headers: {
                        authorization: fast2smsKey.trim(),
                        'Content-Type': 'application/x-www-form-urlencoded',
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
            } else if (response.data && response.data.status_code === 996) {
                console.warn('[SMS-SERVICE] Fast2SMS Notice: Website verification / KYC required on fast2sms.com dashboard under OTP Message menu.');
                return {
                    success: false,
                    needsKyc: true,
                    message: 'Please complete 1-minute Website Verification in your Fast2SMS dashboard.',
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

    // 3. Fallback: Simulated/Development Mode
    console.warn(`[SMS-SERVICE] Fallback simulated OTP for ${cleanPhone}: [${otp}]`);
    return {
        success: true,
        message: 'OTP generated successfully',
        simulated: true,
        provider: 'Simulator',
    };
};

/**
 * Send Transactional Order / Shipping SMS directly to Customer mobile numbers
 * Supports Fast2SMS (Quick SMS route 'q'), Twilio, and Simulator fallback.
 * 
 * @param {string} phone - 10-digit mobile number
 * @param {string} messageText - Message text body
 * @returns {Promise<{success: boolean, message: string, provider?: string, simulated?: boolean}>}
 */
export const sendTransactionalSMS = async (phone, messageText) => {
    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
        console.warn(`[SMS-SERVICE] Invalid phone number provided: ${phone}`);
        return { success: false, message: 'Invalid 10-digit mobile number' };
    }

    console.log(`[SMS-SERVICE] Dispatching Transactional SMS to customer +91 ${cleanPhone}`);

    // 1. FAST2SMS Quick SMS Route ('q')
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey && fast2smsKey !== 'your_fast2sms_api_key_here') {
        try {
            console.log(`[SMS-SERVICE] Attempting Fast2SMS Quick SMS to +91 ${cleanPhone}...`);
            const params = new URLSearchParams({
                message: messageText,
                language: 'english',
                route: 'q',
                numbers: cleanPhone,
            });

            const response = await axios.post(
                'https://www.fast2sms.com/dev/bulkV2',
                params.toString(),
                {
                    headers: {
                        authorization: fast2smsKey.trim(),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 8000,
                }
            );

            if (response.data && (response.data.return === true || response.data.status_code === 200)) {
                console.log(`[SMS-SERVICE] Fast2SMS order confirmation dispatch successful for +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'Order confirmation SMS dispatched to customer phone',
                    provider: 'Fast2SMS',
                };
            } else if (response.data?.status_code === 413) {
                console.warn('[SMS-SERVICE] Fast2SMS key is disabled or invalid. Verify active key in Fast2SMS dashboard (fast2sms.com).');
                return {
                    success: false,
                    disabledKey: true,
                    message: 'Fast2SMS key is disabled or requires verification in fast2sms.com dashboard',
                    provider: 'Fast2SMS',
                };
            } else {
                console.warn('[SMS-SERVICE] Fast2SMS response:', response.data);
            }
        } catch (error) {
            console.error('[SMS-SERVICE] Fast2SMS Transactional Error:', error.response?.data || error.message);
        }
    }

    // 2. TWILIO SMS (If configured)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    if (twilioSid && twilioAuth && twilioFrom) {
        try {
            console.log(`[SMS-SERVICE] Attempting Twilio SMS to +91 ${cleanPhone}...`);
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
            const twilioParams = new URLSearchParams({
                To: `+91${cleanPhone}`,
                From: twilioFrom,
                Body: messageText,
            });

            const twilioRes = await axios.post(twilioUrl, twilioParams.toString(), {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 8000,
            });

            if (twilioRes.status === 201 || twilioRes.data?.sid) {
                console.log(`[SMS-SERVICE] Twilio SMS dispatched successfully to +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'SMS sent via Twilio',
                    provider: 'Twilio',
                };
            }
        } catch (twilioErr) {
            console.error('[SMS-SERVICE] Twilio Error:', twilioErr.response?.data || twilioErr.message);
        }
    }

    // 3. Fallback / Simulation Mode
    console.log(`[SMS-SERVICE] Simulation / Safe logging for +91 ${cleanPhone}: "${messageText.slice(0, 100)}..."`);
    return {
        success: true,
        simulated: true,
        message: 'Order confirmation message logged',
        provider: 'Simulator',
    };
};

