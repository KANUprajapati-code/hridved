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
 * Fast2SMS Quick OTP Route ('otp') - No DLT Registration required!
 * Fast2SMS uses their pre-approved DLT template and delivers numeric OTP directly.
 * 
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp - 6-digit numeric OTP code
 * @returns {Promise<{success: boolean, message: string, simulated?: boolean, provider?: string, statusCode?: number}>}
 */
export const sendSMS = async (phone, otp, options = {}) => {
    // Clean phone number (strip +91 or non-digits)
    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
        return { success: false, message: 'Invalid 10-digit Indian mobile number' };
    }

    const cleanOtp = String(otp).trim();
    console.log(`[SMS-SERVICE] Initiating SMS dispatch for +91 ${cleanPhone}`);

    let lastError = '';
    let lastStatusCode = null;

    // 1. APITxT Unified OTP Gateway (No-DLT - Supports SMS, WhatsApp, and Voice)
    const apitxtKey = process.env.APITXT_AUTH_KEY;
    if (apitxtKey && apitxtKey.trim()) {
        const channel = (options.channel || process.env.APITXT_CHANNEL || 'sms').toLowerCase();
        try {
            console.log(`[SMS-SERVICE] Dispatching via APITxT Unified API (${channel.toUpperCase()}) to +91 ${cleanPhone}...`);
            const params = new URLSearchParams();
            params.append('authkey', apitxtKey.trim());
            params.append('mobile', cleanPhone);
            params.append('otp', cleanOtp);
            params.append('channel', channel);
            params.append('country', String(options.country || '91'));

            if (options.templateId || process.env.APITXT_TEMPLATE_ID) {
                params.append('template_id', String(options.templateId || process.env.APITXT_TEMPLATE_ID));
            }
            if (options.templateName || process.env.APITXT_TEMPLATE_NAME) {
                params.append('template_name', String(options.templateName || process.env.APITXT_TEMPLATE_NAME));
            }
            if (options.projectRefId || process.env.APITXT_PROJECT_REF_ID) {
                params.append('project_ref_id', String(options.projectRefId || process.env.APITXT_PROJECT_REF_ID));
            }

            const response = await axios.post(
                'https://apitxt.com/api/sendOTP',
                params.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 10000,
                }
            );

            if (response.data && (response.data.status === 'success' || response.status === 200)) {
                const reqId = response.data.data?.request_id || response.data.request_id || `APITXT-${Date.now()}`;
                const cost = response.data.data?.cost;
                console.log(`[SMS-SERVICE] APITxT ${channel.toUpperCase()} OTP delivered successfully to +91 ${cleanPhone}. Request ID: ${reqId}${cost !== undefined ? `, Cost: ₹${cost}` : ''}`);
                return {
                    success: true,
                    message: channel === 'whatsapp'
                        ? 'OTP delivered to your WhatsApp'
                        : (channel === 'voice' ? 'OTP delivered via voice call' : 'OTP delivered to your mobile phone via SMS'),
                    provider: `APITxT (${channel.toUpperCase()} OTP)`,
                    requestId: reqId,
                    cost: cost,
                };
            }

            console.warn('[SMS-SERVICE] APITxT returned non-success:', response.data);
            lastError = response.data?.message || 'APITxT delivery failed';
        } catch (apiErr) {
            const errData = apiErr.response?.data;
            lastStatusCode = apiErr.response?.status;
            lastError = errData?.message || apiErr.message;
            console.warn(`[SMS-SERVICE] APITxT attempt failed (HTTP ${lastStatusCode}):`, errData || apiErr.message);
        }
    }

    // 2. Return status if APITxT did not deliver
    console.warn(`[SMS-SERVICE] APITxT did not deliver to ${cleanPhone}. Reason: ${lastError || 'Gateway unavailable'}`);
    return {
        success: false,
        statusCode: lastStatusCode,
        message: lastError || 'SMS gateway unavailable',
        provider: 'APITxT',
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

