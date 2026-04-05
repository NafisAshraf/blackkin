// Type declaration for sslcommerz-lts (no official @types package)
declare module "sslcommerz-lts" {
  interface SSLCommerzOptions {
    total_amount: number;
    currency: string;
    tran_id: string;
    success_url: string;
    fail_url: string;
    cancel_url: string;
    ipn_url: string;
    product_name: string;
    product_category: string;
    product_profile: string;
    cus_name: string;
    cus_email: string;
    cus_add1: string;
    cus_add2?: string;
    cus_city: string;
    cus_state: string;
    cus_postcode: string;
    cus_country: string;
    cus_phone: string;
    ship_name: string;
    ship_add1: string;
    ship_add2?: string;
    ship_city: string;
    ship_state: string;
    ship_postcode: string;
    ship_country: string;
    shipping_method?: string;
    num_of_item?: number;
    cart?: string;
    product_amount?: number;
    vat?: number;
    discount_amount?: number;
    convenience_fee?: number;
    value_a?: string;
    value_b?: string;
    value_c?: string;
    value_d?: string;
    [key: string]: unknown;
  }

  interface SSLCommerzInitResponse {
    status: string;
    failedreason?: string;
    sessionkey?: string;
    GatewayPageURL?: string;
    storeBanner?: string;
    storeLogo?: string;
    [key: string]: unknown;
  }

  interface SSLCommerzValidateResponse {
    status: string;
    tran_id?: string;
    val_id?: string;
    amount?: string;
    store_amount?: string;
    bank_tran_id?: string;
    card_type?: string;
    card_no?: string;
    card_brand?: string;
    card_issuer?: string;
    card_issuer_country?: string;
    currency?: string;
    risk_level?: string;
    risk_title?: string;
    [key: string]: unknown;
  }

  class SSLCommerzPayment {
    constructor(store_id: string, store_passwd: string, is_live: boolean);
    init(data: SSLCommerzOptions): Promise<SSLCommerzInitResponse>;
    validate(data: { val_id: string }): Promise<SSLCommerzValidateResponse>;
  }

  export = SSLCommerzPayment;
}
