import crypto from 'crypto';
import axios from 'axios';
import Transaction from '../models/Transaction.js';
import Order from '../models/Order.js';

/**
 * @desc    Create PhonePe Payment
 * @route   POST /api/payment/create
 * @access  Private
 */
const createPhonePePayment = async (req, res) => {
    try {
        const { amount, orderId } = req.body;
        const userId = req.user._id;

        // PhonePe Settings
        const merchantId = process.env.PHONEPE_MERCHANT_ID;
        const saltKey = process.env.PHONEPE_SALT_KEY;
        const saltIndex = process.env.PHONEPE_SALT_INDEX;
        const baseUrl = process.env.PHONEPE_BASE_URL;

        const merchantTransactionId = `MT${Date.now()}`;
        const merchantUserId = `MUID${userId}`;

        const payload = {
            merchantId,
            merchantTransactionId,
            merchantUserId,
            amount: amount * 100, // Amount in paise
            redirectUrl: `${process.env.FRONTEND_URL}/api/payment/status/${merchantTransactionId}`,
            redirectMode: "POST",
            paymentInstrument: {
                type: "PAY_PAGE",
            },
        };

        const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
        const base64EncodedPayload = bufferObj.toString("base64");
        const xVerify = crypto
            .createHash("sha256")
            .update(base64EncodedPayload + "/pg/v1/pay" + saltKey)
            .digest("hex") + "###" + saltIndex;

        const options = {
            method: "post",
            url: `${baseUrl}/pay`,
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": xVerify,
            },
            data: {
                request: base64EncodedPayload,
            },
        };

        const response = await axios.request(options);

        // Store Transaction in DB
        await Transaction.create({
            user: userId,
            order: orderId,
            merchantTransactionId,
            amount,
            status: 'PENDING',
        });

        res.status(200).json(response.data.data.instrumentResponse.redirectInfo.url);

    } catch (error) {
        console.error("PhonePe Create Error:", error.response?.data || error.message);
        res.status(500).json({ message: "Payment Initiation Failed" });
    }
};

/**
 * @desc    Check PhonePe Payment Status
 * @route   POST /api/payment/status/:merchantTransactionId
 * @access  Public (Callback/Status Check)
 */
const checkPhonePeStatus = async (req, res) => {
    try {
        const { merchantTransactionId } = req.params;
        const merchantId = process.env.PHONEPE_MERCHANT_ID;
        const saltKey = process.env.PHONEPE_SALT_KEY;
        const saltIndex = process.env.PHONEPE_SALT_INDEX;
        const baseUrl = process.env.PHONEPE_BASE_URL;

        const xVerify = crypto
            .createHash("sha256")
            .update(`/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey)
            .digest("hex") + "###" + saltIndex;

        const options = {
            method: "get",
            url: `${baseUrl}/status/${merchantId}/${merchantTransactionId}`,
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": xVerify,
                "X-MERCHANT-ID": merchantId,
            },
        };

        const response = await axios.request(options);
        const transaction = await Transaction.findOne({ merchantTransactionId });

        if (response.data.success && response.data.code === 'PAYMENT_SUCCESS') {
            if (transaction) {
                transaction.status = 'SUCCESS';
                transaction.transactionId = response.data.data.transactionId;
                transaction.paymentResponse = response.data;
                await transaction.save();

                // Update Order Status
                const order = await Order.findById(transaction.order);
                if (order) {
                    order.isPaid = true;
                    order.paidAt = Date.now();
                    order.paymentResult = {
                        id: response.data.data.transactionId,
                        status: 'COMPLETED',
                        update_time: Date.now().toString(),
                        email_address: req.user?.email || 'N/A'
                    };
                    await order.save();
                }
            }
            return res.redirect(`${process.env.FRONTEND_REDIRECT_URL}/checkout/success?id=${transaction?.order}`);
        } else {
            if (transaction) {
                transaction.status = 'FAILED';
                transaction.paymentResponse = response.data;
                await transaction.save();
            }
            return res.redirect(`${process.env.FRONTEND_REDIRECT_URL}/checkout/failed`);
        }

    } catch (error) {
        console.error("PhonePe Status Error:", error.response?.data || error.message);
        res.redirect(`${process.env.FRONTEND_REDIRECT_URL}/checkout/failed`);
    }
};

export { createPhonePePayment, checkPhonePeStatus };
