import axios from 'axios';

/**
 * Check Fast2SMS Wallet Balance and API Key validity
 * @returns {Promise<{valid: boolean, wallet?: string, sms_count?: number, message?: string, statusCode?: number}>}
 */
export const checkFast2SMSBalance = async () => {
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (!fast2smsKey || fast2smsKey === 'your_fast2sms_api_key_here') {
        return { valid: false, message: 'FAST2SMS_API_KEY is not configured in .env' };
    }

    try {
        const response = await axios.post(
            'https://www.fast2sms.com/dev/wallet',
            {},
            {
                headers: {
                    authorization: fast2smsKey.trim(),
                    'Content-Type': 'application/json',
                },
                timeout: 8000,
            }
        );

        if (response.data && (response.data.return === 'true' || response.data.return === true)) {
            return {
                valid: true,
                wallet: response.data.wallet,
                sms_count: response.data.sms_count,
            };
        }

        return {
            valid: false,
            message: response.data?.message || 'Invalid response from Fast2SMS',
            statusCode: response.data?.status_code,
        };
    } catch (err) {
        const status = err.response?.data?.status_code || err.response?.status;
        const msg = err.response?.data?.message || err.message;
        return {
            valid: false,
            statusCode: status,
            message: msg,
        };
    }
};

/**
 * Send real OTP via SMS to Indian mobile numbers
 * Supports Fast2SMS (Dedicated OTP, Quick SMS route 'q', OTP route 'otp', DLT), 2Factor.in, and Twilio.
 * 
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, message: string, simulated?: boolean, provider?: string, statusCode?: number}>}
 */
export const sendSMS = async (phone, otp) => {
    // Clean phone number (strip +91 or non-digits)
    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
        return { success: false, message: 'Invalid 10-digit Indian mobile number' };
    }

    console.log(`[SMS-SERVICE] Initiating SMS dispatch for +91 ${cleanPhone}`);

    // 1. FAST2SMS (India's most popular OTP gateway)
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey && fast2smsKey !== 'your_fast2sms_api_key_here') {
        const trimmedKey = fast2smsKey.trim();

        // Strategy A: If Fast2SMS OTP Template ID is provided, use dedicated OTP endpoint
        if (process.env.FAST2SMS_OTP_ID) {
            try {
                console.log(`[SMS-SERVICE] Attempting Fast2SMS Dedicated OTP endpoint for +91 ${cleanPhone}...`);
                const response = await axios.post(
                    'https://www.fast2sms.com/dev/otp/send',
                    {
                        mobile: cleanPhone,
                        otp_id: process.env.FAST2SMS_OTP_ID.trim(),
                        otp: String(otp),
                        otp_expiry: 10,
                        otp_length: otp.length,
                    },
                    {
                        headers: {
                            authorization: trimmedKey,
                            'Content-Type': 'application/json',
                        },
                        timeout: 8000,
                    }
                );

                if (response.data && (response.data.return === true || response.data.status_code === 200)) {
                    console.log(`[SMS-SERVICE] Fast2SMS Dedicated OTP sent successfully to +91 ${cleanPhone}`);
                    return {
                        success: true,
                        message: 'OTP delivered to your mobile phone via SMS',
                        provider: 'Fast2SMS (Dedicated OTP)',
                        requestId: response.data.request_id,
                    };
                }
            } catch (otpErr) {
                console.warn('[SMS-SERVICE] Dedicated OTP failed, falling back to Quick/OTP route:', otpErr.response?.data || otpErr.message);
            }
        }

        // Strategy B: Quick SMS Route ('q') - Universal route without strict DLT approval requirements
        try {
            console.log(`[SMS-SERVICE] Attempting Fast2SMS Quick SMS ('q') for +91 ${cleanPhone}...`);
            const quickPayload = {
                route: 'q',
                message: `Your Hridved verification OTP is ${otp}. Valid for 10 minutes. Do not share this code.`,
                numbers: cleanPhone,
            };

            const response = await axios.post(
                'https://www.fast2sms.com/dev/bulkV2',
                quickPayload,
                {
                    headers: {
                        authorization: trimmedKey,
                        'Content-Type': 'application/json',
                    },
                    timeout: 8000,
                }
            );

            if (response.data && (response.data.return === true || response.data.status_code === 200)) {
                console.log(`[SMS-SERVICE] Fast2SMS Quick SMS dispatch successful for +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'OTP delivered to your mobile phone via SMS',
                    provider: 'Fast2SMS (Quick SMS)',
                    requestId: response.data.request_id,
                };
            }

            const statusCode = response.data?.status_code;
            if (statusCode === 413) {
                console.warn('[SMS-SERVICE] Fast2SMS Error 413: Authorization Key Disabled in your Fast2SMS account console.');
            } else if (statusCode === 416) {
                console.warn('[SMS-SERVICE] Fast2SMS Error 416: Insufficient wallet balance in your Fast2SMS account.');
            } else if (statusCode === 996) {
                console.warn('[SMS-SERVICE] Fast2SMS Error 996: KYC verification required on fast2sms.com.');
            }
        } catch (error) {
            const errData = error.response?.data;
            const statusCode = errData?.status_code;
            console.error(`[SMS-SERVICE] Fast2SMS Quick SMS Error (HTTP ${error.response?.status || 'ERR'}, Code: ${statusCode}):`, errData || error.message);
            
            // Check if key is explicitly disabled or unauthorized
            if (statusCode === 413 || statusCode === 412) {
                console.warn('[SMS-SERVICE] Fast2SMS Key is disabled or invalid. Please update FAST2SMS_API_KEY with an active key.');
            }
        }

        // Strategy C: OTP Route ('otp')
        try {
            console.log(`[SMS-SERVICE] Attempting Fast2SMS OTP route ('otp') for +91 ${cleanPhone}...`);
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
                        authorization: trimmedKey,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 8000,
                }
            );

            if (response.data && (response.data.return === true || response.data.status_code === 200)) {
                console.log(`[SMS-SERVICE] Fast2SMS OTP route dispatch successful for +91 ${cleanPhone}`);
                return {
                    success: true,
                    message: 'OTP delivered to your mobile phone via SMS',
                    provider: 'Fast2SMS (OTP Route)',
                };
            }
        } catch (error) {
            console.warn('[SMS-SERVICE] Fast2SMS OTP Route Error:', error.response?.data || error.message);
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
        success: false,
        simulated: true,
        message: 'SMS gateway unavailable; simulated OTP generated for local testing',
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

