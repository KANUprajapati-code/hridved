const axios = require('axios');
const base = (process.env.FSHIP_BASE_URL || 'https://api.fship.in').replace(/\/+$/, '');
const path = process.env.FSHIP_PATH_SERVICEABILITY || '/v1/courier/serviceability';
const url = `${base}${path}`;
const key = process.env.FSHIP_TEST_KEY || process.env.FSHIP_SIGNATURE || process.env.FSHIP_API_KEY || '';
const dest = process.env.FSHIP_TEST_DEST || '0';
const src = process.env.FSHIP_TEST_SOURCE || '560001';

if (!key) console.warn('[probe] No test key provided (set FSHIP_TEST_KEY or FSHIP_SIGNATURE or FSHIP_API_KEY)');

const headersToTry = [
  { name: 'signature', value: key },
  { name: 'x-api-key', value: key },
  { name: 'Authorization', value: `Bearer ${key}` },
  { name: 'Authorization', value: key },
  { name: 'Token', value: key }
];

(async () => {
  console.log('[probe] URL:', url);
  const payload = {
    source_Pincode: src,
    destination_Pincode: dest,
    sourcePincode: src,
    destinationPincode: dest
  };

  for (const h of headersToTry) {
    try {
      const hdrs = { 'Content-Type': 'application/json' };
      if (h.value) hdrs[h.name] = h.value;
      console.log(`\n[probe] Trying header: ${h.name} -> ${String(h.value).substring(0, 40)}...`);
      const res = await axios.post(url, payload, { headers: hdrs, timeout: 15000 });
      console.log(`[probe] ${h.name} => ${res.status} ${res.statusText}`);
      console.log('Response body:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      if (err.response) {
        console.log(`[probe] ${h.name} => ${err.response.status} ${err.response.statusText}`);
        try { console.log('Response data:', JSON.stringify(err.response.data)); } catch(e){ console.log('Response data: (non-JSON)'); }
      } else {
        console.log(`[probe] ${h.name} => ERROR:`, err.message);
      }
    }
  }
})();
