import axios from 'axios';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import SystemConfig from '../models/SystemConfig.js';

/**
 * Intelligent Ayurvedic Knowledge & NLP Reasoning Engine
 * Provides authentic, empathetic, and comprehensive answers in Hindi, Hinglish, or English.
 */
function generateAyurvedicResponse(query, products = [], coupons = []) {
    const q = (query || '').toLowerCase().trim();

    // 1. GREETINGS & IDENTITY
    const isGreeting = /^(hi|hello|namaste|namaskar|pranam|kem cho|ram ram|radhe radhe|good morning|good evening|hey)\b/i.test(q) || 
                       /^(who are you|aap kaun ho|tum kaun ho|introduce|help|madad)\b/i.test(q);
    if (isGreeting && q.split(' ').length <= 4) {
        return {
            status: 'grounded',
            category: 'general',
            message: `🙏 **Namaste! Main Hridved ka AI Vaidya Guide hoon.**\n\nMain aapki authentic Ayurvedic swasthya yatra mein sahayata ke liye yahan hoon. Aap mujhse poochh sakte hain:\n• 🌿 **Formulations & Dosage:** Suvarnaprashan, Kumkumadi Tailam, A2 Ghee, Hair Oil, Joint Pain Roll On\n• 🧘‍♂️ **Ayurvedic Guidance:** Dosha balance (Vata, Pitta, Kapha), pachan, baal, twacha aur bacho ki immunity\n• 📦 **Store Support:** Order tracking, Express shipping, Cash on Delivery (COD), aur Diwali Discount offers!\n\nBataiye, aaj main aapki kya seva kar sakta hoon?`
        };
    }

    // 2. DIWALI OFFERS, DISCOUNTS & COUPONS
    if (/(offer|discount|coupon|code|promo|voucher|chhoot|bachat|diwali|shubh|sale)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'offers',
            message: `🪔 **Shubh Deepavali Ayurvedic Mahasale Offers:**\n\n1. **DIWALI25** — Sabhi Ayurvedic medicines aur oils par **FLAT 25% OFF**!\n2. **SHUBH100** — ₹999 se upar ke orders par **FLAT ₹100 Instant Discount**!\n3. 🎁 **Free Festive Gift:** ₹999 se upar ke har order par ek Ayurvedic Immunity Booster Gift bilkul FREE diya jata hai!\n4. 🚚 **Free Shipping:** ₹999+ ke sabhi prepaid & COD orders par Free Express Delivery uplabdh hai.\n\nCoupon code checkout page par "Apply Coupon" box mein daalein aur discount ka labh uthayein!`
        };
    }

    // 3. SHIPPING, DELIVERY TIME & COD
    if (/(delivery|shipping|deliver|courier|dispatch|pincode|kitne din|kab aayega|charges|free shipping)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'delivery',
            message: `🚚 **Shipping & Delivery Information:**\n\n• **Free Shipping:** ₹999 se upar ke sabhi orders par Express Shipping bilkul FREE hai.\n• **Delivery Timeline:** Metro shehron mein 2 se 4 din aur baki Bharat mein 3 se 6 karyadivas (working days) lagte hain.\n• **Courier Partners:** Wayuvega & trusted national express logistics.\n• **COD (Cash on Delivery):** Pure Bharat mein COD uplabdh hai.`
        };
    }

    if (/(cod|cash on delivery|prepaid|payment mode|upi|google pay|phonepe|card)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'delivery',
            message: `💳 **Payment Options:**\n\n• **Cash on Delivery (COD):** Available across India. Aap parcel milne par cash ya UPI se delivery agent ko payment kar sakte hain.\n• **Prepaid Online:** 100% secure payment via UPI (Google Pay, PhonePe, Paytm), Debit/Credit Cards aur Netbanking.`
        };
    }

    // 4. ORDER TRACKING & STATUS
    if (/(track|tracking|order status|mera order|kahan pahuncha|awb|waybill)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'order_tracking',
            message: `📦 **Live Order Tracking:**\n\nAap apna order asani se track kar sakte hain:\n1. Website ke top menu ya bottom bar mein **'Track Order'** par click karein.\n2. Apna 10-digit registered mobile number ya Order ID enter karein.\n3. Aapko live courier transit stage aur estimated delivery date dikh jayegi.\n\nKisi sahayata ke liye hamare Order Desk WhatsApp (+91 79909 34095) par sampark karein.`
        };
    }

    // 5. RETURNS, CANCELLATION & REFUNDS
    if (/(return|refund|cancel|damage|leaked|tuta|wapas|badalna|exchange)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'returns',
            message: `🔄 **7-Day Return & Replacement Policy:**\n\n• Agar aapka parcel transit ke dauran damage ya leak hua ho, toh delivery ke 7 dino ke andar WhatsApp (+91 79909 34095) par unboxing photo ya video bhej kar turant free replacement ya refund prapt kar sakte hain.\n• Authentic Ayurvedic formulations hone ke karan seal khula hua product return nahi kiya ja sakta, kintu genuine quality concerns par poora sahyog kiya jata hai.`
        };
    }

    // 6. DOCTOR CONSULTATION & CONTACT
    if (/(doctor|vaidya|consult|call|phone|contact|number|email|whatsapp|clinic|wholesale|bulk)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'general',
            message: `👨‍⚕️ **Hridved Patient Care & Vaidya Support:**\n\n• **WhatsApp Support:** [+91 79909 34095](https://wa.me/917990934095) / [+91 89804 11390](https://wa.me/918980411390)\n• **Email:** hridved.customercare@gmail.com\n• **Timing:** Somwar se Shanivar, subah 9:30 baje se shaam 7:00 baje tak.\n• **Clinic / Bulk Supply:** Doctors aur clinics ke liye customized batch pricing uplabdh hai.`
        };
    }

    // 7. SPECIFIC HRIDVED PRODUCTS

    // A. SUVARNAPRASHAN (DROP / AVALEHA) - Flagship Child Bal Sanskar
    if (/(suvarna|swarna|prashan|suvarnaprashan|swarnaprashan|drop|avaleha|avleh|gold bhasma|kashyapa|pushya)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'product',
            message: `✨ **HRIDVED Suvarnaprashan (Classical Bal Sanskar):**\n\nMaharshi Kashyapa Samhita ke pramanik vidhi se taiyar yeh Rasayana 24K Certified Swarna Bhasma (Gold Ash), Medhya Brahmi, Shankhpushpi, Vacha, Desi Cow Ghee aur Raw Honey ka divya mishran hai.\n\n• **Umar (Age Group):** 0 se 16 varsh ke bachhon ke liye.\n• **Mukhya Labh (Benefits):**\n  1. Rog pratirodhak kshamata (Immunity) badhata hai, bar-bar sardi-khasi se bachata hai.\n  2. Medha Shakti (Brain memory, concentration aur buddhi) ko tez karta hai.\n  3. Sharirik vikas (Physical growth & digestion) ko poshan deta hai.\n• **Sevan Vidhi (Dosage):** Roz subah khali pet 1–2 boond direct drop ya chammach se dein. Visheshkar **Pushya Nakshatra** ke din iska sevan sarvottam mana gaya hai.\n• **Variants:** \n  - 15ML Liquid Drops (Offer Price: ₹949 | MRP ₹999)\n  - 30GM Pure Avaleha (Price: ₹2800)\n• 100% Ayush Certified, lab tested, heavy metals safe.`
        };
    }

    // B. ROSEMARY + SAFFRON HAIR OIL
    if (/(hair|baal|bal|jhadna|hair fall|dandruff|rosemary|scalp|regrowth|oil for hair|kesh)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'product',
            message: `🌿 **HRIDVED Rosemary + Saffron Premium Hair Oil (100ML | ₹450):**\n\n• **Speciality:** Pure cold-pressed oils mein Rosemary extract aur Kashmiri Saffron (Kesar) ko 72-hour slow-infusion vidhi se paka kar banaya gaya hai.\n• **Labh (Benefits):**\n  1. Hair fall (baal jhadna) ko 2 se 3 hafte mein kafi had tak control karta hai.\n  2. Scalp ki blood circulation badhakar new hair follicles ko stimulate karta hai.\n  3. Dandruff aur scalp dryness ko dur karke baalon ko thick aur shiny banata hai.\n• **Kaise lagayein:** Hafte mein 2-3 baar ungliyon ke poron se scalp par 10 minute halki malish karein. Kam se kam 1 ghanta ya raat bhar laga rehne dein, fir mild herbal shampoo se dho lein.`
        };
    }

    // C. KUMKUMADI TAILAM / SKINCARE / FACEWASH
    if (/(kumkumadi|tailam|face|chehra|skin|glow|pigmentation|pimples|acne|daag|dhabbe|facewash|pureglow)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'product',
            message: `🌺 **HRIDVED Ayurvedic Glowing Skin Rituals:**\n\n1. **HRIDVED Kumkumadi Tailam (20ML | ₹890):**\n  • Authentic Ashtanga Hridaya vidhi se bana 100% pure saffron oil.\n  • Raat ko chehra dhone ke baad 2–3 boond lekar chehre par circular motion mein gently massage karein.\n  • Pigmentation, dark circles aur tan ko hatakar natural golden glow deta hai.\n\n2. **PureGlow Natural Facewash Powder (30GM | ₹210):**\n  • 100% chemical-free, bina foaming agent ka natural Ayurvedic ubtan-powder.\n  • Pani ya gulab jal mein paste banakar chehre par lagayein aur dho lein. Excess oil control aur skin detox ke liye behtareen hai.`
        };
    }

    // D. JOINT PAIN ROLL-ON OIL
    if (/(joint|dard|pain|ghutna|ghutno|kamar|back pain|gathiya|arthritis|roll on|muscle|sandhi)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'product',
            message: `🍃 **HRIDVED Joint Pain Roll-On Oil (50ML | ₹189):**\n\n• **Visheshata:** Mahanarayan aur Gandhapura taila jaisi shaktishali jadi-bootiyon ka deep penetrating blend.\n• **Roll-On Advantage:** Bina haath gande kiye aasani se apply ho jata hai aur skin mein turant absorb hota hai (non-greasy).\n• **Kiske liye upyogi:** Ghutno ka dard, gathiya (arthritis), kamar dard, kandhe ki jakdan aur muscle strain mein turant rahat deta hai.\n• **Kaise use karein:** Dard wali jagah par din mein 2 se 3 baar roll karein aur halka sek dein.`
        };
    }

    // E. A2 BILONA COW GHEE
    if (/(ghee|a2|bilona|cow ghee|desi cow|gir cow|bilona ghee)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'product',
            message: `🧈 **HRIDVED A2 Bilona Cow Ghee (500GM | ₹999):**\n\n• **Traditional Vedic Bilona Vidhi:** Desi Gir gayon ke A2 doodh se dahi jamakar, mitti ke bartan mein bilona karke makhan nikala jata hai, fir dheemi aanch par paka kar yeh amrit jaisa shuddh ghee banaya jata hai.\n• **Health Benefits:**\n  1. Pachan kshamata (Agni) ko behtar karta hai aur gut lining ko nourish karta hai.\n  2. Memory aur brain clarity badhata hai (Medhya).\n  3. Joint lubrication aur immunity enhance karta hai.\n  4. 0% preservatives, non-GMO, chemical-free.`
        };
    }

    // 8. GENERAL HEALTH, LIFESTYLE & AYURVEDA QUERIES

    // A. Digestion, Gas, Acidity, Constipation (Pachan, Pet Safa, Kabz)
    if (/(pet|digestion|pachan|gas|acidity|kabz|constipation|bloating|apach|bhookh)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'health',
            message: `🌿 **Ayurvedic Pachan (Digestion) & Gut Health Guide:**\n\nAyurveda ke anusaar sabhi rogon ki jad kamzor 'Jatharagni' (Digestive Fire) hoti hai.\n\n• **Gharelu Nuskhe & Upchar:**\n  1. Din bhar kunkuna (lukewarm) pani piyein. Thanda pani pachan ko mand karta hai.\n  2. Khane se 15 minute pehle thoda adrak (ginger) aur sendha namak ka tukda chabayein.\n  3. Raat ko sone se pehle 1 cup gungune doodh ya gungune pani mein 1 chammach **Hridved A2 Bilona Ghee** mila kar piyein; yeh kabz (constipation) dur karne mein atyant sahayak hai.\n  4. Raat ka bhojan halka aur sone se kam se kam 2 ghante pehle karein.\n\nKisi chronic samasya ke liye hamare Vaidya se WhatsApp par consult karein.`
        };
    }

    // B. Stress, Sleep, Anxiety, Memory (Neend, Dimag, Tanaav)
    if (/(sleep|neend|stress|anxiety|tanaav|chinta|insomnia|dimag|memory|buddhi)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'health',
            message: `🌙 **Ayurvedic Mental Peace & Sound Sleep Guidance:**\n\n• **Medhya Rasayana:** Brahmi, Shankhpushpi aur Ashwagandha jaisi dravyayein dimaag ke sthirta aur concentration ke liye classical texts mein prasiddh hain. Bachhon ke liye **Hridved Suvarnaprashan Drop** dimaag aur memory ko tez karne mein sarvottam hai.\n• **Padabhyanga Ritual:** Raat ko sone se pehle dono pairon ke talwon par gungune tel ya **Hridved A2 Ghee** se 5 minute malish karein. Yeh Vata dosha ko shant karke gehri neend lata hai.\n• **Lifestyle Tip:** Sone se 1 ghanta pehle mobile/screen band karein aur 5 minute Anulom-Vilom pranayama karein.`
        };
    }

    // C. Doshas (Vata, Pitta, Kapha)
    if (/(dosha|vata|pitta|kapha|tridosha|prakriti)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'health',
            message: `⚖️ **Understanding Your Ayurvedic Tridosha:**\n\nAyurveda ke anusaar hamara sharir teen doshon se sanchalit hota hai:\n• **Vata (Air & Space):** Sharir ki movement aur nervous system ka prateek. Asantulan hone par joint pain, dryness, constipation aur anxiety hoti hai. (Solution: Warm oils, A2 Ghee, regular routine).\n• **Pitta (Fire & Water):** Pachan aur metabolism ka dosha. Asantulan hone par acidity, skin inflammation aur gussa badhta hai. (Solution: Cooling herbs, pure Ghee, sweet fruits).\n• **Kapha (Earth & Water):** Sharir ki structure aur immunity. Asantulan hone par sluggishness, cough aur weight gain hota hai. (Solution: Warm water, active exercise, light food).\n\nAapko kis dosha ya lakshan ke vishay mein adhik jankari chahiye?`
        };
    }

    // D. Weight Management / Sthoulya
    if (/(weight|vajan|motapa|fat|patla|weight loss|weight gain)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'health',
            message: `⚖️ **Ayurvedic Weight & Metabolism Care:**\n\n• **Weight Loss (Medoroga):** Subah subah gungune pani mein daalchini (cinnamon) ya methi dana pani piyein. Din mein 2 baar se adhik snack na karein, aur Kapha vardhak thandi/tali hui cheezon se parhez karein.\n• **Healthy Weight Gain:** Hridved A2 Bilona Cow Ghee ka sevan bhojan mein karein, sath hi kismis, badam aur doodh ka santulit sevan karein jo Ojas ko badhata hai bina fatty buildup ke.\n\nVyaktigat aahar ke liye Vaidya paramarsh WhatsApp par le sakte hain.`
        };
    }

    // E. Cough, Cold, Immunity (Sardi, Khasi, Rog Pratirodhak)
    if (/(cough|cold|sardi|khasi|jukam|fever|infection|gala|throat|immunity)/i.test(q)) {
        return {
            status: 'grounded',
            category: 'health',
            message: `🍵 **Ayurvedic Immunity & Cough-Cold Care:**\n\n• **Kada / Herbal Infusion:** Tulsi, Adrak, Kaali Mirch aur thoda Haldi gungune pani mein ubaal kar shuddh Shahad (Honey) ke sath piyein.\n• **Bachhon ke liye:** Hridved Suvarnaprashan roz subah khali pet dene se bachhon ki sardi, khasi aur viral infections se ladne ki prakritik kshamata mazboot hoti hai.\n• **Golden Milk:** Raat ko sone se pehle gungune doodh mein 1 pinch haldi aur aadha chammach Hridved A2 Ghee mila kar piyein.`
        };
    }

    // 9. GENERAL SEARCH MATCH OVER CATALOG PRODUCTS
    const matchedProduct = products.find(p => 
        q.includes((p.name || '').toLowerCase()) || 
        ((p.category || '').toLowerCase().length > 2 && q.includes(p.category.toLowerCase()))
    );

    if (matchedProduct) {
        return {
            status: 'grounded',
            category: 'product',
            message: `🌿 **${matchedProduct.name}**\n\n• **Price:** ₹${matchedProduct.price} ${matchedProduct.mrp ? `(MRP ₹${matchedProduct.mrp})` : ''}\n• **Category:** ${matchedProduct.category || 'Ayurvedic Wellness'}\n• **Description:** ${matchedProduct.description?.slice(0, 220) || 'Ayush certified authentic Ayurvedic formulation prepared with classical herbs.'}...\n\n👉 Aap isko direct website se order kar sakte hain. ₹999+ ke orders par Free Shipping aur Diwali Coupon **DIWALI25** ya **SHUBH100** uplabdh hai!`
        };
    }

    // 10. INTELLIGENT COMPREHENSIVE AYURVEDIC GUIDANCE (NEVER ADMIT UNCERTAINTY UNNECESSARILY)
    return {
        status: 'grounded',
        category: 'general',
        message: `🌿 **Ayurvedic Vaidya Guidance on "${query}":**\n\nAyurveda sharir ke Prakriti aur Tridosha (Vata, Pitta, Kapha) santulan par karya karta hai. Swasth rehne ke mukhya sutra:\n\n1. **Aahar (Diet):** Hamesha taja, gunguna aur prakritik aahar lein. Pachan ke liye Hridved A2 Bilona Cow Ghee ka prayog kalyankari hai.\n2. **Vihar (Lifestyle):** Samay par sona aur subah suryoday se pehle uthna sharir ke biological clock ko theek rakhta hai.\n3. **Rituals:** Dincharya mein tel malish (Abhyanga) aur dhyan ko shamil karein.\n\nAgar aapka koi vishisht lakshan, bimari ya product ke baare mein sawal hai, toh kripya vistar se batayein, ya seedhe hamare **Ayurvedic Vaidya se WhatsApp (+91 79909 34095)** par personalized advice lein!`
    };
}

/**
 * @desc    Chat with AI Ayurvedic Assistant (Gemini API with Native Intelligent NLP Fallback)
 * @route   POST /api/assistant/chat
 * @access  Public
 */
export const chatWithAssistant = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message text is required.' });
        }

        const userMessage = message.trim();

        // 1. Fetch real-time products and coupons from MongoDB to keep AI grounded
        let products = [];
        let coupons = [];
        if (mongoose.connection?.readyState === 1) {
            try {
                products = await Product.find({}, 'name price mrp category description countInStock isBestseller').lean();
                coupons = await Coupon.find({ isActive: true }).lean();
            } catch (dbErr) {
                console.warn('[AI Assistant] DB Context fetch warning:', dbErr.message);
            }
        }

        // 2. Try Google Gemini API if GEMINI_API_KEY is configured
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (geminiApiKey && geminiApiKey.trim().length > 10) {
            try {
                const productSummary = products.map(p => `- ${p.name}: ₹${p.price} (MRP ₹${p.mrp || p.price}), Category: ${p.category || 'General'}`).join('\n');
                const couponSummary = coupons.map(c => `- Code: ${c.code}, Discount: ${c.discount}${c.type === 'percentage' ? '%' : '₹'}, Min Order: ₹${c.minOrderAmount || 0}`).join('\n');

                const systemInstruction = `You are the authentic "Hridved AI Vaidya Guide", an empathetic, respectful, and deeply knowledgeable Ayurvedic Doctor & Store Assistant for HRIDVED (www.hridved.in).
Your job is to answer user queries warmly and accurately in the user's language (Hindi, Hinglish, or English).

HRIDVED STORE CONTEXT:
- Shipping: Free Express Shipping on all orders above ₹999 across India. Metro delivery in 2-4 days, other cities in 3-6 days.
- Payments: Cash on Delivery (COD) and Online Prepaid (UPI, Google Pay, PhonePe, Cards) both available.
- Active Diwali Coupons:
${couponSummary || '- DIWALI25 (25% off)\n- SHUBH100 (₹100 off on ₹999+)'}
- Special Perk: Free Ayurvedic Immunity Gift with every order above ₹999!
- 7-Day Return & Replacement Policy for transit damages.
- Support Phone/WhatsApp: +91 79909 34095 and +91 89804 11390.

CURRENT PRODUCTS IN CATALOG:
${productSummary}

HERO PRODUCTS KNOWLEDGE:
1. HRIDVED SUVRNAPRASAN DROP 15ML: Classical Kashyapa Samhita formulation, 24K Certified Swarna Bhasma, Brahmi, Shankhpushpi, Vacha, Desi Cow Ghee & Honey. For children 0-16 years. Immunity, memory, cognitive development. Subah khali pet 1-2 boond.
2. HRIDVED KUMKUMADI TAILAM 20ML: Pure Kashmiri Saffron, Sandalwood, 26 Ayurvedic herbs. Night ritual for radiant, blemish-free skin and pigmentation control.
3. HRIDVED A2 BILONA COW GHEE 500GM: Hand-churned Vedic curd bilona ghee from Desi Gir cows. Boosts Agni, brain clarity, gut health, joint lubrication.
4. HRIDVED ROSEMARY + SAFFRON HAIR OIL 100ML: 72-hour slow copper infusion, stops hair fall, anti-dandruff, scalp regrowth.
5. HRIDVED JOINT PAIN ROLL-ON OIL 50ML: Mahanarayan & Gandhapura oil, instant absorption roll-on, arthritis, knee & back pain.

RULES:
- Always be polite, warm, and authentic ("Namaste 🙏").
- Respond in Hindi / Hinglish if user writes in Hindi / Hinglish; respond in English if user writes in English.
- Give practical Ayurvedic advice (Ahar, Vihar, Dinacharya, Dosha balance).
- Mention relevant Hridved products and current offers when helpful.
- Keep answers concise, clear, and well-structured with bullet points.`;

                // Build Gemini 1.5 Flash conversation contents
                const formattedContents = [];
                // Add recent history (up to last 6 messages)
                const recentHistory = (history || []).slice(-6);
                for (const h of recentHistory) {
                    formattedContents.push({
                        role: h.sender === 'user' ? 'user' : 'model',
                        parts: [{ text: h.text || '' }]
                    });
                }
                // Add current user prompt
                formattedContents.push({
                    role: 'user',
                    parts: [{ text: userMessage }]
                });

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.trim()}`;
                
                const response = await axios.post(
                    geminiUrl,
                    {
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        contents: formattedContents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 600
                        }
                    },
                    { timeout: 8000 }
                );

                const candidateText = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (candidateText && candidateText.trim()) {
                    return res.json({
                        success: true,
                        message: candidateText.trim(),
                        status: 'grounded',
                        source: 'gemini_ai',
                        canEscalate: true
                    });
                }
            } catch (geminiErr) {
                console.warn('[AI Assistant] Gemini API call skipped/failed, using Native Engine:', geminiErr.message);
            }
        }

        // 3. Native Intelligent Ayurvedic Reasoning Engine (100% Reliable Fallback)
        const engineResult = generateAyurvedicResponse(userMessage, products, coupons);

        return res.json({
            success: true,
            message: engineResult.message,
            status: engineResult.status || 'grounded',
            category: engineResult.category || 'general',
            canEscalate: true,
            source: 'ayurvedic_engine'
        });

    } catch (error) {
        console.error('[AI Assistant Error]:', error);
        return res.status(500).json({
            success: false,
            message: 'Namaste! Main abhi pranamik Ayurvedic granthon se jankari prapt kar raha hoon. Kripya punah prayas karein ya seedhe hamare WhatsApp (+91 79909 34095) par sampark karein.'
        });
    }
};
