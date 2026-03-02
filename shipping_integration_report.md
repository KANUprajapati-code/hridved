# Shipping Integration Report
Generated on: 2/3/2026, 10:16:16 am


## Fship Serviceability (Staging) - FAILED
**URL:** `https://capi-qc.fship.in/api/pincodeserviceability`
**Method:** `POST`
**Status:** `401`

### Request JSON
```json
{
  "source_Pincode": "383325",
  "destination_Pincode": "400001"
}
```

### Response JSON
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "Unauthorized",
  "status": 401,
  "traceId": "00-5c2fbdbb95123aa08d542cdfa62c6217-063bfb8f72a6ca96-00"
}
```
---


## Fship Order Creation (Staging) - FAILED
**URL:** `https://capi-qc.fship.in/api/createforwardorder`
**Method:** `POST`
**Status:** `401`

### Request JSON
```json
{}
```

### Response JSON
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "Unauthorized",
  "status": 401,
  "traceId": "00-205d06b7bdc773053f854ff9048bd00c-6fd2e5c41e389519-00"
}
```
---


## Vamaship Rates (Staging) - FAILED
**URL:** `https://ecom3stagingapi.vamaship.com/ecom/api/v1/dom/quote`
**Method:** `POST`
**Status:** `ERROR`

### Request JSON
```json
{}
```

### Response JSON
```json
"certificate has expired"
```
---


## Vamaship Order Creation (Staging) - FAILED
**URL:** `https://ecom3stagingapi.vamaship.com/ecom/api/v1/shipments/book`
**Method:** `POST`
**Status:** `ERROR`

### Request JSON
```json
{}
```

### Response JSON
```json
"certificate has expired"
```
---
