# SSLCOMMERZ v4 – Full Payment Gateway Setup

This is a Markdown‑ready single‑file guide covering the **whole SSLCOMMERZ v4 flow**: environments, how to integrate, required parameters, `CREATE and GET Session`, IPN handling, and Order Validation API. [web:5][web:11]

---

## 1. Overview

SSLCOMMERZ lets merchants in Bangladesh accept online payments via:

- Credit/debit cards (VISA, MasterCard, Amex, Nexus).  
- Mobile banking (bKash, DBBL Mobile, etc.).  
- Internet banking (Brac, City Touch, IBBL, etc.). [web:5]

There are **two UI flows**:

1. **Easy Checkout** – embedded JS buttons on your checkout page.  
2. **Hosted Payment** – redirect to SSLCOMMERZ’s hosted payment page. [web:5]

The **backend integration** is the same for both: three core APIs:

1. **Create and Get Session** – initiate payment.  
2. **IPN (Instant Payment Notification)** – server‑to‑server status update.  
3. **Order Validation API** – double‑check that the payment is valid and amount matches. [web:5][web:11]

---

## 2. Environments and testing

SSLCOMMERZ provides **Sandbox (test)** and **Live (production)** environments. [web:5]

### URLs

- **Live:** `https://securepay.sslcommerz.com` [web:5]  
- **Sandbox:** `https://sandbox.sslcommerz.com` [web:5]

Use separate `store_id` / `store_passwd` for each environment.

### Test credentials and card numbers

You must:

- Register at:
  - Sandbox: `https://developer.sslcommerz.com/registration/`  
  - Live: `https://signup.sslcommerz.com/register` [web:5]

#### Test card numbers (Sandbox)

- **VISA:** `4111111111111111` (exp: `12/26`, CVV: `111`)  
- **Mastercard:** `5111111111111111` (exp: `12/26`, CVV: `111`)  
- **American Express:** `371111111111111` (exp: `12/26`, CVV: `111`) [web:5]

#### Test OTP

- **Mobile OTP:** `111111` or `123456` [web:5]

---

## 3. Integration methods

### 3.1 Easy Checkout (embedded)

- Load SSLCOMMERZ’s JS on your checkout page.  
- Payment channels (cards, mobile banks, internet banks) are rendered inline on your site.  
- Your backend still calls the **Create and Get Session** API and handles IPN/Validation. [web:5]

### 3.2 Hosted Payment (redirect)

- After checkout, call **Create and Get Session** on your backend.  
- Redirect the customer to the `GatewayPageURL` returned by SSLCOMMERZ.  
- After payment, SSLCOMMERZ hits your `success_url` / `fail_url` and sends an IPN POST. [web:5][web:11]

---

## 4. Technical / backend flow

Conceptually, the flow is split into three stages: [web:5]

1. **Transaction Initiate**  
   - Your backend → SSLCOMMERZ: `POST gwprocess/v4/api.php` → receive `sessionkey` and `GatewayPageURL` → redirect customer. [web:5]

2. **Handling Payment Notification**  
   - SSLCOMMERZ sends an IPN POST to your `ipn_url` as soon as the bank confirms the payment.  
   - You must validate that POST and then call the **Order Validation API**. [web:5]

3. **Service Confirmation**  
   - The customer is redirected to `success_url` / `fail_url` / `cancel_url`.  
   - You update your order status only after IPN + Order Validation confirm. [web:5]

---

## 5. Initiate Payment – request parameters

You must send a `POST` to `https://sandbox.sslcommerz.com/gwprocess/v4/api.php` (or live URL) with the following parameters. [web:5][web:11]

### 5.1 Integration required parameters

| Parameter        | Type   | Description |
|------------------|--------|-------------|
| `store_id`       | string | Your store ID (credential). |
| `store_passwd`   | string | Your store password (credential). |
| `total_amount`   | decimal| Amount to charge; must be `10.00`–`500000.00` BDT. |
| `currency`       | string | 3‑letter code (e.g., `BDT`, `USD`, `EUR`). |
| `tran_id`        | string | Unique transaction ID for your order. |
| `product_category` | string | Open field (e.g., `clothing`, `topup`, `air ticket`). |
| `success_url`    | string | URL to redirect after successful payment. |
| `fail_url`       | string | URL to redirect after payment failure. |
| `cancel_url`     | string | URL to redirect if the customer cancels. |
| `ipn_url`        | string | IPN listener URL (server‑to‑server notification). [web:5] |
| `multi_card_name`| string | Gateways to show (e.g., `mastercard,visacard`). *Do not use unless you want to customize.* [web:5] |
| `allowed_bin`    | string | Comma‑separated BINs to restrict card usage. *Do not use unless you want to restrict.* [web:5] |

### 5.2 EMI parameters

| Parameter              | Type    | Description |
|------------------------|---------|-------------|
| `emi_option`           | integer | `1` if EMI is enabled; `0` otherwise. |
| `emi_max_inst_option`  | integer | Maximum installments shown (e.g., `3`, `6`, `9`). |
| `emi_selected_inst`    | integer | Pre‑selected installment count (if already chosen on your site). |
| `emi_allow_only`       | integer | `1` = only EMI; `0` = mixed channels. Depends on the above EMI fields. [web:5] |

### 5.3 Customer information

| Parameter        | Type   | Description |
|------------------|--------|-------------|
| `cus_name`       | string | Customer name (for receipt). |
| `cus_email`      | string | Customer email (for receipt). |
| `cus_add1`       | string | Address line 1. |
| `cus_add2`       | string | Address line 2. |
| `cus_city`       | string | Customer city. |
| `cus_state`      | string | Customer state. |
| `cus_postcode`   | string | Customer postcode. |
| `cus_country`    | string | Customer country. |
| `cus_phone`      | string | Phone / mobile number. |
| `cus_fax`        | string | Fax number (optional). [web:5] |

### 5.4 Shipment information (for SSLCOMMERZ_LOGISTIC)

Used when shipping via SSLCOMMERZ’s logistics system (from 2022‑10‑01). [web:5]

| Parameter               | Type    | Description |
|-------------------------|---------|-------------|
| `shipping_method`       | string  | `YES`, `NO`, `Courier`, or `SSLCOMMERZ_LOGISTIC`. |
| `num_of_item`           | integer | Number of shipped items. |
| `weight_of_items`       | decimal | Weight in kg. |
| `logistic_pickup_id`    | string  | Pickup ID from your merchant portal. |
| `logistic_delivery_type`| string  | Delivery type for logistics. |
| `ship_name`             | string  | Shipping name (if `shipping_method` ≠ `NO`). |
| `ship_add1`, `ship_add2`| string  | Shipping address lines. |
| `ship_area`             | string  | Shipping area. |
| `ship_city`             | string  | Shipping city. |
| `ship_sub_city`         | string  | Shipping sub‑city/thana. |
| `ship_state`            | string  | Shipping state. |
| `ship_postcode`         | string  | Shipping postcode. |
| `ship_country`          | string  | Shipping country. [web:5] |

### 5.5 Product information

| Parameter            | Type    | Description |
|----------------------|---------|-------------|
| `product_name`       | string  | Comma‑separated product names (max 255 chars). |
| `product_category`   | string  | Category (e.g., `Electronics`, `topup`, `air ticket`). |
| `product_profile`    | string  | Vertical: `general`, `physical-goods`, `non-physical-goods`, `airline-tickets`, `travel-vertical`, `telecom-vertical`. [web:5] |

#### Extra fields for specific profiles

- **`airline-tickets`:** `hours_till_departure`, `flight_type`, `pnr`, `journey_from_to`, `third_party_booking`.  
- **`travel-vertical`:** `hotel_name`, `length_of_stay`, `check_in_time`, `hotel_city`.  
- **`telecom-vertical`:** `product_type` (`Prepaid`/`Postpaid`), `topup_number`, `country_topup`. [web:5]

| Parameter        | Type    | Description |
|------------------|---------|-------------|
| `cart`           | JSON    | Array of `sku`, `product`, `quantity`, `amount`, `unit_price`. Example: `[{\"sku\":\"...\",\"product\":\"...\",\"quantity\":\"...\",\"amount\":\"...\",\"unit_price\":\"...\"}]`. |
| `product_amount` | decimal | Product price (for reconciliation). |
| `vat`            | decimal | VAT amount. |
| `discount_amount`| decimal | Discount on invoice. |
| `convenience_fee`| decimal | Additional fee. [web:5] |

### 5.6 Custom / extra parameters

| Parameter | Type   | Description |
|----------|--------|-------------|
| `value_a`| string | Extra metadata. |
| `value_b`| string | Extra metadata. |
| `value_c`| string | Extra metadata. |
| `value_d`| string | Extra metadata. |

These are passed back in IPN and validation responses. [web:5][web:11]

---

## 6. Create and Get Session – API call

Call this from your backend after checkout. [web:5]

### Endpoint

- **Sandbox:**  
  `POST https://sandbox.sslcommerz.com/gwprocess/v4/api.php`  
- **Live:**  
  `POST https://securepay.sslcommerz.com/gwprocess/v4/api.php` [web:5]

### Example (curl)

```bash
curl -X POST https://sandbox.sslcommerz.com/gwprocess/v4/api.php \
  -d 'store_id=testbox&\
store_passwd=qwerty&\
total_amount=100&\
currency=EUR&\
tran_id=REF123&\
success_url=http://yoursite.com/success.php&\
fail_url=http://yoursite.com/fail.php&\
cancel_url=http://yoursite.com/cancel.php&\
cus_name=Customer Name&\
cus_email=cust@yahoo.com&\
cus_add1=Dhaka&\
cus_add2=Dhaka&\
cus_city=Dhaka&\
cus_state=Dhaka&\
cus_postcode=1000&\
cus_country=Bangladesh&\
cus_phone=01711111111&\
cus_fax=01711111111&\
ship_name=Customer Name&\
ship_add1=Dhaka&\
ship_add2=Dhaka&\
ship_city=Dhaka&\
ship_state=Dhaka&\
ship_postcode=1000&\
ship_country=Bangladesh'
```

### Response fields

| Parameter        | Type   | Description |
|------------------|--------|-------------|
| `status`         | string | `SUCCESS` or `FAILED`. |
| `failedreason`   | string | Error text if `status` is `FAILED`. |
| `sessionkey`     | string | Unique session key to store against `tran_id`. |
| `gw`             | object | Maps gateway types (`visa`, `master`, `amex`, etc.) to gateway IDs. |
| `GatewayPageURL` | string | URL to redirect the customer for payment. |
| `storeBanner`    | string | Store banner image URL (if any). |
| `storeLogo`      | string | Store logo URL (if any). |
| `desc`           | array  | Descriptions of each gateway (name, type, logo, `gw` key, `redirectGatewayURL`). [web:5] |

Typical flow:

1. Store `sessionkey` in your DB with `tran_id`.  
2. Redirect the customer to `GatewayPageURL`. [web:5]

---

## 7. IPN – handling payment notifications

You **must** configure an IPN URL in your SSLCOMMERZ merchant panel and implement a listener endpoint. [web:5]

### IPN POST parameters

SSLCOMMERZ sends a `POST` request to your `ipn_url` with the following fields. [web:5]

| Parameter              | Type    | Description |
|------------------------|---------|-------------|
| `status`               | string  | `VALID`, `FAILED`, `CANCELLED`, `EXPIRED`, `UNATTEMPTED`. Only `VALID` is a success. |
| `tran_date`            | datetime| Payment completion time (e.g., `2016-05-08 15:53:49`). |
| `tran_id`              | string  | Your transaction ID sent at initiation. Validate against your DB. |
| `val_id`               | string  | Validation ID from SSLCOMMERZ. |
| `amount`               | decimal | Final amount (possibly converted to BDT). |
| `store_amount`         | decimal | Amount you will receive after bank charges. |
| `card_type`            | string  | Bank gateway (e.g., `VISA‑Dutch Bangla`). |
| `card_no`              | string  | Masked card number or reference ID. |
| `currency`             | string  | Settlement currency. |
| `bank_tran_id`         | string  | Transaction ID at the bank’s end. |
| `card_issuer`          | string  | Issuer bank name. |
| `card_brand`           | string  | `VISA`, `MASTER`, `AMEX`, `IB`, `MOBILE BANKING`. |
| `card_issuer_country`  | string  | Country name. |
| `card_issuer_country_code` | string | 2‑letter country code. |
| `currency_type`        | string  | Original currency sent at initiation. |
| `currency_amount`      | decimal | Original currency amount. |
| `value_a`…`value_d`    | string  | Your custom metadata. |
| `verify_sign`          | string  | Data validation key. |
| `verify_key`           | string  | Key listing which fields are signed. |
| `risk_level`           | integer | `0` = safe, `1` = risky. |
| `risk_title`           | string  | Risk‑level description. [web:5] |

Your listener must:

1. Validate the `status`, `tran_id`, `amount`, and `verify_sign`.  
2. Call the **Order Validation API** before updating your DB. [web:5]

---

## 8. Order Validation API

Use this API to **double‑check** that the payment is valid and the amount matches. [web:5]

### Endpoints

- **Sandbox:** `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php`  
- **Live:** `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php` [web:5]

**Method:** `GET`.

### Request parameters

| Parameter      | Type   | Description |
|----------------|--------|-------------|
| `val_id`       | string | Validation ID from IPN. |
| `store_id`     | string | Your store ID. |
| `store_passwd` | string | Your store password. |
| `format`       | string | `json` or `xml` (default: `json`). |
| `v`            | integer| Reserved for future use. [web:5] |

### Example (curl)

```bash
curl -G "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php" \
  --data-urlencode "val_id=1711231900331kHP17lnrr9T8Gt" \
  --data-urlencode "store_id=testbox" \
  --data-urlencode "store_passwd=qwerty"
```

### Returned parameters

| Parameter                  | Type    | Description |
|----------------------------|---------|-------------|
| `status`                   | string  | `VALID`, `VALIDATED`, `INVALID_TRANSACTION`. |
| `tran_date`                | datetime| Payment completion date. |
| `tran_id`                  | string  | Transaction ID (validate against your DB). |
| `val_id`                   | string  | Validation ID. |
| `amount`                   | decimal | Final amount. |
| `store_amount`             | decimal | Amount after bank charges. |
| `card_type`                | string  | Gateway name. |
| `card_no`                  | string  | Masked card / ref ID. |
| `currency`                 | string  | Settlement currency. |
| `bank_tran_id`             | string  | Bank’s transaction ID. |
| `card_issuer`              | string  | Issuer bank name. |
|