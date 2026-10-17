const logger = require("../utils/logger");

const STAGING_BASE_URL = "https://staging-express.delhivery.com";
const PROD_BASE_URL = "https://track.delhivery.com";

class DelhiveryService {
  constructor(config = {}) {
    this._token = config.token;
    this._env = config.env;
    this._clientName = config.clientName;
    this._warehouseName = config.warehouseName;
    this._warehousePincode = config.warehousePincode;
    this._timeoutMs = config.timeoutMs;
  }

  get token() {
    return this._token !== undefined ? this._token : (process.env.DELHIVERY_API_TOKEN || "");
  }

  set token(val) {
    this._token = val;
  }

  get env() {
    return (this._env !== undefined ? this._env : (process.env.DELHIVERY_ENV || "staging")).toLowerCase();
  }

  set env(val) {
    this._env = val;
  }

  get clientName() {
    return this._clientName !== undefined ? this._clientName : (process.env.DELHIVERY_CLIENT_NAME || "");
  }

  set clientName(val) {
    this._clientName = val;
  }

  get warehouseName() {
    return this._warehouseName !== undefined ? this._warehouseName : (process.env.DELHIVERY_WAREHOUSE_NAME || "");
  }

  set warehouseName(val) {
    this._warehouseName = val;
  }

  get warehousePincode() {
    return this._warehousePincode !== undefined ? this._warehousePincode : (process.env.DELHIVERY_WAREHOUSE_PINCODE || "");
  }

  set warehousePincode(val) {
    this._warehousePincode = val;
  }

  get timeoutMs() {
    return Number(this._timeoutMs !== undefined ? this._timeoutMs : process.env.DELHIVERY_REQUEST_TIMEOUT_MS) || 10000;
  }

  set timeoutMs(val) {
    this._timeoutMs = val;
  }

  /**
   * Resolves the base URL according to the configured environment
   */
  getBaseUrl() {
    if (this.env === "production") {
      return PROD_BASE_URL;
    }
    if (this.env === "staging" || this.env === "test") {
      return STAGING_BASE_URL;
    }
    throw new Error(`Invalid DELHIVERY_ENV "${this.env}". Expected "staging" or "production".`);
  }

  /**
   * Constructs sanitized headers for API requests
   */
  getAuthHeaders() {
    if (!this.token) {
      throw new Error("DELHIVERY_API_TOKEN is not configured.");
    }
    return {
      "Authorization": `Token ${this.token.trim()}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  }

  /**
   * Strips token or secret credentials from headers for safe logging
   */
  sanitizeHeaders(headers = {}) {
    const sanitized = { ...headers };
    if (sanitized["Authorization"] || sanitized["authorization"]) {
      sanitized["Authorization"] = "Token [REDACTED]";
      delete sanitized["authorization"];
    }
    return sanitized;
  }

  /**
   * Dispatches an HTTP request to Delhivery with timeout & error normalization
   */
  async request(path, options = {}) {
    const baseUrl = this.getBaseUrl();
    const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    const headers = { ...this.getAuthHeaders(), ...(options.headers || {}) };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

    const safeHeaders = this.sanitizeHeaders(headers);
    logger.debug(`[Delhivery] Outgoing ${options.method || "GET"} ${path}`, { headers: safeHeaders });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (typeof data === "object" && data !== null)
          ? data.message || data.error || data.detail || JSON.stringify(data)
          : String(data || response.statusText);

        const err = new Error(`Delhivery API Error (${response.status}): ${errorMsg}`);
        err.statusCode = response.status;
        err.responseBody = data;
        logger.error(`[Delhivery] Request failed: ${err.message}`, { status: response.status });
        throw err;
      }

      return data;
    } catch (error) {
      clearTimeout(timeout);

      if (error.name === "AbortError") {
        const timeoutErr = new Error(`Delhivery request timed out after ${options.timeoutMs || this.timeoutMs}ms`);
        timeoutErr.statusCode = 504;
        logger.error(`[Delhivery] ${timeoutErr.message}`);
        throw timeoutErr;
      }

      // Re-throw normalized error
      throw error;
    }
  }

  /**
   * Checks pincode serviceability and returns a normalized response
   * @param {string|number} pincode - 6-digit Indian postal code
   */
  async checkPincodeServiceability(pincode) {
    if (!pincode) {
      const err = new Error("Pincode is required.");
      err.statusCode = 400;
      throw err;
    }

    const cleanPin = String(pincode).trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      const err = new Error("Invalid pincode format. Must be a 6-digit number not starting with 0.");
      err.statusCode = 400;
      throw err;
    }

    const data = await this.request(`/c/api/pin-codes/json/?filter_codes=${cleanPin}`);

    // Parse delivery_codes array from Delhivery response
    const deliveryCodes = Array.isArray(data?.delivery_codes) ? data.delivery_codes : [];
    const matched = deliveryCodes.find(item => String(item?.postal_code?.pin) === cleanPin) || deliveryCodes[0];

    if (!matched || !matched.postal_code) {
      return {
        serviceable: false,
        pincode: cleanPin,
        prepaidAvailable: false,
        codAvailable: false,
        message: "Pincode is not serviceable by Delhivery"
      };
    }

    const pc = matched.postal_code;
    const hasPrepaid = typeof pc.pre_paid === "string"
      ? pc.pre_paid.trim().toUpperCase() === "Y"
      : (typeof pc.pre_paid === "boolean" ? pc.pre_paid : null);

    const hasCod = typeof pc.cod === "string"
      ? pc.cod.trim().toUpperCase() === "Y"
      : (typeof pc.cash === "string" ? pc.cash.trim().toUpperCase() === "Y" : (typeof pc.cod === "boolean" ? pc.cod : null));

    const isPickup = typeof pc.pickup === "string"
      ? pc.pickup.trim().toUpperCase() === "Y"
      : (typeof pc.pickup === "boolean" ? pc.pickup : null);

    const isServiceable = hasPrepaid === true || hasCod === true || isPickup === true;

    return {
      serviceable: isServiceable,
      pincode: cleanPin,
      prepaidAvailable: hasPrepaid !== null ? hasPrepaid : false,
      codAvailable: hasCod !== null ? hasCod : false,
      city: pc.district || pc.city || undefined,
      state: pc.state || undefined,
      message: isServiceable
        ? "Pincode is serviceable"
        : "Pincode is currently not serviceable"
    };
  }

  /**
   * Calculates shipping rate / freight charges via Delhivery Rate Calculator API
   * @param {Object} params
   * @param {string|number} [params.originPincode] - 6-digit origin pincode (defaults to warehouse pincode)
   * @param {string|number} params.destinationPincode - 6-digit destination pincode
   * @param {number} params.weightGrams - Actual weight in grams (> 0)
   * @param {Object} [params.dimensions] - Optional package dimensions { lengthCm, widthCm, heightCm }
   * @param {string} [params.paymentMode] - "prepaid" | "cod" (default: "prepaid")
   * @param {string} [params.mode] - Shipment mode: "E" (Express) | "S" (Surface) (default: "E")
   */
  async calculateShippingRate({
    originPincode,
    destinationPincode,
    weightGrams,
    dimensions,
    paymentMode = "prepaid",
    mode = "E"
  } = {}) {
    const oPin = String(originPincode || this.warehousePincode || "").trim();
    if (!oPin || !/^[1-9][0-9]{5}$/.test(oPin)) {
      const err = new Error("Origin pincode is required and must be a 6-digit number not starting with 0.");
      err.statusCode = 400;
      throw err;
    }

    const dPin = String(destinationPincode || "").trim();
    if (!dPin || !/^[1-9][0-9]{5}$/.test(dPin)) {
      const err = new Error("Destination pincode is required and must be a 6-digit number not starting with 0.");
      err.statusCode = 400;
      throw err;
    }

    const weight = Number(weightGrams);
    if (isNaN(weight) || weight <= 0) {
      const err = new Error("Weight is required and must be a positive number in grams.");
      err.statusCode = 400;
      throw err;
    }

    let chargeableWeight = weight;
    if (dimensions !== undefined && dimensions !== null) {
      const l = Number(dimensions.lengthCm ?? dimensions.length);
      const w = Number(dimensions.widthCm ?? dimensions.width);
      const h = Number(dimensions.heightCm ?? dimensions.height);

      if (isNaN(l) || l <= 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
        const err = new Error("Dimensions must contain positive numbers for length, width, and height in cm.");
        err.statusCode = 400;
        throw err;
      }

      // Volumetric weight formula (cm^3 / 5000) * 1000 = grams
      const volumetricGrams = (l * w * h) / 5;
      chargeableWeight = Math.max(weight, volumetricGrams);
    }

    const normPayment = String(paymentMode || "prepaid").trim().toLowerCase();
    if (!["prepaid", "cod", "pre-paid"].includes(normPayment)) {
      const err = new Error("Payment mode must be either 'prepaid' or 'cod'.");
      err.statusCode = 400;
      throw err;
    }
    const pt = normPayment === "cod" ? "COD" : "Pre-paid";
    const md = String(mode || "E").trim().toUpperCase() === "S" ? "S" : "E";

    const query = new URLSearchParams({
      d_pin: dPin,
      o_pin: oPin,
      cgm: String(Math.round(chargeableWeight)),
      pt: pt,
      md: md,
      ss: "Delivered"
    });

    if (this.clientName) {
      query.append("cl", this.clientName);
    }

    const data = await this.request(`/api/kinko/v1/invoice/charges/.json?${query.toString()}`);

    const chargeObj = Array.isArray(data) ? data[0] : (data?.data || data);
    if (!chargeObj || typeof chargeObj !== "object") {
      const err = new Error("Malformed rate response from vendor.");
      err.statusCode = 502;
      throw err;
    }

    if (chargeObj.status === "fail" || chargeObj.error) {
      const err = new Error(`Delhivery Rate Error: ${chargeObj.error || chargeObj.message || "Failed to calculate charges"}`);
      err.statusCode = 400;
      throw err;
    }

    const totalAmount = Number(
      chargeObj.total_amount ?? chargeObj.amount ?? chargeObj.charge ?? chargeObj.total ?? 0
    );

    if (isNaN(totalAmount) || totalAmount < 0) {
      const err = new Error("Vendor response missing valid total_amount.");
      err.statusCode = 502;
      throw err;
    }

    const result = {
      success: true,
      amount: totalAmount,
      currency: "INR",
      estimated: true,
      chargeableWeightGrams: Math.round(chargeableWeight)
    };

    if (chargeObj.zone) {
      result.zone = String(chargeObj.zone);
    }

    if (chargeObj.charge_DL !== undefined || chargeObj.charge_COD !== undefined) {
      result.breakdown = {
        freightCharge: Number(chargeObj.charge_DL || 0),
        codCharge: Number(chargeObj.charge_COD || 0),
        fuelSurcharge: Number(chargeObj.charge_FS || 0)
      };
    }

    return result;
  }

  /**
   * Creates a forward shipment with Delhivery (Manifestation / AWB generation)
   * @param {Object} order - Full LYVO Mongoose Order object or document
   */
  async createForwardShipment(order) {
    if (!order || typeof order !== "object") {
      const err = new Error("Order object is required.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Duplicate Protection Check
    if (order.shipping?.waybill) {
      return {
        success: false,
        duplicate: true,
        waybill: order.shipping.waybill,
        message: `Shipment already manifested with AWB ${order.shipping.waybill}`
      };
    }

    // 2. Warehouse & Client Configuration
    if (!this.warehouseName) {
      const err = new Error("DELHIVERY_WAREHOUSE_NAME is not configured in environment.");
      err.statusCode = 400;
      throw err;
    }

    // 3. Shipping Address Validation
    const addr = order.shippingAddress;
    if (!addr || typeof addr !== "object") {
      const err = new Error("Order is missing shipping address details.");
      err.statusCode = 400;
      throw err;
    }

    const name = String(addr.fullName || order.user?.name || "").trim();
    if (!name) {
      const err = new Error("Customer name is required in shipping address.");
      err.statusCode = 400;
      throw err;
    }

    const fullAddress = String(addr.address || `${addr.houseNo || ""} ${addr.street || ""}`).trim();
    if (!fullAddress) {
      const err = new Error("Delivery address line is required.");
      err.statusCode = 400;
      throw err;
    }

    const pin = String(addr.zipCode || "").trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      const err = new Error("Valid 6-digit destination PIN code is required.");
      err.statusCode = 400;
      throw err;
    }

    const phone = String(addr.phone || order.user?.phone || "").replace(/\D/g, "");
    if (phone.length < 10) {
      const err = new Error("Valid 10-digit customer phone number is required.");
      err.statusCode = 400;
      throw err;
    }

    // 4. Payment Mode & Weight
    const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
    const paymentMode = isCod ? "COD" : "Prepaid";
    const codAmount = isCod ? String(Math.round(order.pricing?.total || 0)) : "0";

    const weight = Number(order.shipping?.packageDetails?.weightGrams || 1200);
    if (isNaN(weight) || weight <= 0) {
      const err = new Error("Package weight must be a positive number in grams.");
      err.statusCode = 400;
      throw err;
    }

    const length = Number(order.shipping?.packageDetails?.dimensions?.lengthCm || 34);
    const width = Number(order.shipping?.packageDetails?.dimensions?.widthCm || 24);
    const height = Number(order.shipping?.packageDetails?.dimensions?.heightCm || 13);

    const productDesc = order.items?.map(i => i.name).filter(Boolean).join(", ").slice(0, 80) || "Sneakers";
    const totalQty = order.items?.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0) || 1;
    const orderDate = new Date(order.createdAt || Date.now()).toISOString().replace("T", " ").slice(0, 19);

    // 5. Construct Delhivery CMU B2C Payload
    const cmuPayload = {
      shipments: [
        {
          name,
          add: fullAddress,
          pin,
          city: String(addr.city || "").trim(),
          state: String(addr.state || "").trim(),
          country: String(addr.country || "India").trim(),
          phone,
          order: String(order.orderNumber || order._id),
          payment_mode: paymentMode,
          return_pin: "",
          return_city: "",
          return_phone: "",
          return_add: "",
          return_state: "",
          return_country: "",
          products_desc: productDesc,
          hsn_code: "",
          cod_amount: codAmount,
          order_date: orderDate,
          total_amount: String(Math.round(order.pricing?.total || 0)),
          seller_add: "",
          seller_name: this.clientName || "LYVO",
          seller_inv: "",
          quantity: String(totalQty),
          waybill: "",
          shipment_width: String(width),
          shipment_height: String(height),
          weight: String(weight),
          seller_gst_tin: "",
          shipping_mode: "Express",
          address_type: "home"
        }
      ],
      pickup_location: {
        name: this.warehouseName
      }
    };

    const bodyString = `format=json&data=${encodeURIComponent(JSON.stringify(cmuPayload))}`;

    const data = await this.request("/api/cmu/create.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyString
    });

    if (!data || typeof data !== "object") {
      const err = new Error("Malformed shipment response from Delhivery.");
      err.statusCode = 502;
      throw err;
    }

    if (data.success === false) {
      const err = new Error(`Delhivery Shipment Creation Failed: ${data.rmk || data.error || "Unknown vendor error"}`);
      err.statusCode = 400;
      throw err;
    }

    const pkg = Array.isArray(data.packages) ? data.packages[0] : null;
    if (pkg && pkg.status === "Fail") {
      const reason = Array.isArray(pkg.remarks) ? pkg.remarks.join(", ") : String(pkg.remarks || "Validation failed");
      const err = new Error(`Delhivery Package Error: ${reason}`);
      err.statusCode = 400;
      throw err;
    }

    const waybill = pkg?.waybill || data.upload_wbn;
    if (!waybill) {
      const err = new Error("Delhivery response did not return a valid AWB/waybill.");
      err.statusCode = 502;
      throw err;
    }

    return {
      success: true,
      waybill: String(waybill),
      shipmentId: String(data.upload_wbn || pkg?.upload_wbn || order.orderNumber),
      pickupLocation: this.warehouseName,
      delhiveryStatus: pkg?.status || "Manifested",
      delhiveryStatusCode: "MAN",
      uploadWbn: data.upload_wbn || pkg?.upload_wbn || "",
      rawResponse: data
    };
  }

  /**
   * Verifies Delhivery connectivity and credential validity via pincode serviceability check
   */
  async verifyHealth() {
    if (!this.token) {
      return {
        healthy: false,
        env: this.env,
        message: "DELHIVERY_API_TOKEN is not configured"
      };
    }

    try {
      // Validate environment string
      this.getBaseUrl();

      // Check serviceability for warehouse pincode or default Delhi PIN 110001
      const testPincode = this.warehousePincode || "110001";
      const result = await this.checkPincodeServiceability(testPincode);

      return {
        healthy: true,
        env: this.env,
        clientName: this.clientName || undefined,
        warehouseName: this.warehouseName || undefined,
        message: "Delhivery API connected successfully",
        serviceabilitySample: result
      };
    } catch (error) {
      return {
        healthy: false,
        env: this.env,
        statusCode: error.statusCode || 500,
        message: error.message || "Failed to reach Delhivery API"
      };
    }
  }
}

// Export singleton instance and class definition
const defaultService = new DelhiveryService();
defaultService.DelhiveryService = DelhiveryService;

module.exports = defaultService;
