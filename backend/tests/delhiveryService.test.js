const delhiveryModule = require("../services/delhiveryService");
const { DelhiveryService } = delhiveryModule;

describe("DelhiveryService Unit Tests (Stage 1, 2A, 2B & 2C)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Configuration & Environment Routing", () => {
    test("should resolve staging base URL correctly", () => {
      const service = new DelhiveryService({ token: "test_token", env: "staging" });
      expect(service.getBaseUrl()).toBe("https://staging-express.delhivery.com");
    });

    test("should resolve production base URL correctly", () => {
      const service = new DelhiveryService({ token: "test_token", env: "production" });
      expect(service.getBaseUrl()).toBe("https://track.delhivery.com");
    });

    test("should throw an error for an invalid environment", () => {
      const service = new DelhiveryService({ token: "test_token", env: "invalid_env" });
      expect(() => service.getBaseUrl()).toThrow(/Invalid DELHIVERY_ENV/);
    });
  });

  describe("Authorization Headers & Token Sanitization", () => {
    test("should construct Authorization header with 'Token <api_token>' format", () => {
      const service = new DelhiveryService({ token: "mock_delhivery_api_key_123" });
      const headers = service.getAuthHeaders();
      expect(headers["Authorization"]).toBe("Token mock_delhivery_api_key_123");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Accept"]).toBe("application/json");
    });

    test("should throw an error when token is missing", () => {
      const service = new DelhiveryService({ token: "" });
      expect(() => service.getAuthHeaders()).toThrow(/DELHIVERY_API_TOKEN is not configured/);
    });

    test("should sanitize Authorization header for safe logging", () => {
      const service = new DelhiveryService({ token: "secret_live_token" });
      const headers = { Authorization: "Token secret_live_token", "X-Custom": "test" };
      const sanitized = service.sanitizeHeaders(headers);
      expect(sanitized["Authorization"]).toBe("Token [REDACTED]");
      expect(sanitized["X-Custom"]).toBe("test");
    });
  });

  describe("HTTP Request Handling & Mocked Responses", () => {
    test("should successfully parse JSON response from mocked Delhivery API", async () => {
      const mockResponseData = {
        delivery_codes: [
          {
            postal_code: {
              pin: 110001,
              is_oda: "N",
              pre_paid: "Y",
              cod: "Y"
            }
          }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => mockResponseData
      });

      const service = new DelhiveryService({ token: "test_token", env: "staging" });
      const result = await service.request("/c/api/pin-codes/json/?filter_codes=110001");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = global.fetch.mock.calls[0];
      expect(calledUrl).toBe("https://staging-express.delhivery.com/c/api/pin-codes/json/?filter_codes=110001");
      expect(calledOptions.headers["Authorization"]).toBe("Token test_token");
      expect(result).toEqual(mockResponseData);
    });

    test("should normalize HTTP errors (e.g. 401 Unauthorized) into a structured error", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => ({ detail: "Authentication credentials were not provided." })
      });

      const service = new DelhiveryService({ token: "invalid_token", env: "staging" });

      await expect(service.request("/c/api/pin-codes/json/?filter_codes=110001")).rejects.toThrow(
        /Delhivery API Error \(401\)/
      );
    });

    test("should handle request timeout using AbortController", async () => {
      global.fetch = jest.fn().mockImplementation((_, options) => {
        return new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });

      const service = new DelhiveryService({ token: "test_token", timeoutMs: 50 });
      await expect(service.request("/test-timeout", { timeoutMs: 50 })).rejects.toThrow(
        /Delhivery request timed out after 50ms/
      );
    });
  });

  describe("Pincode Serviceability (Stage 2A)", () => {
    test("should correctly validate and report a serviceable pincode (prepaid + cod)", async () => {
      const mockResponse = {
        delivery_codes: [
          {
            postal_code: {
              pin: 415409,
              district: "Sangli",
              state: "MH",
              pre_paid: "Y",
              cod: "Y",
              pickup: "Y"
            }
          }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => mockResponse
      });

      const service = new DelhiveryService({ token: "test_token", env: "staging" });
      const result = await service.checkPincodeServiceability("415409");

      expect(result).toEqual({
        serviceable: true,
        pincode: "415409",
        prepaidAvailable: true,
        codAvailable: true,
        city: "Sangli",
        state: "MH",
        message: "Pincode is serviceable"
      });
    });

    test("should correctly report a non-serviceable pincode when delivery_codes is empty", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => ({ delivery_codes: [] })
      });

      const service = new DelhiveryService({ token: "test_token", env: "staging" });
      const result = await service.checkPincodeServiceability("999999");

      expect(result).toEqual({
        serviceable: false,
        pincode: "999999",
        prepaidAvailable: false,
        codAvailable: false,
        message: "Pincode is not serviceable by Delhivery"
      });
    });

    test("should handle valid pincode where pre_paid=N and cod=N", async () => {
      const mockResponse = {
        delivery_codes: [
          {
            postal_code: {
              pin: 123456,
              district: "Remote",
              state: "XX",
              pre_paid: "N",
              cod: "N",
              pickup: "N"
            }
          }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => mockResponse
      });

      const service = new DelhiveryService({ token: "test_token", env: "staging" });
      const result = await service.checkPincodeServiceability("123456");

      expect(result).toEqual({
        serviceable: false,
        pincode: "123456",
        prepaidAvailable: false,
        codAvailable: false,
        city: "Remote",
        state: "XX",
        message: "Pincode is currently not serviceable"
      });
    });

    test("should reject invalid pincodes (e.g. 5 digits, 7 digits, starting with 0, alphabetic)", async () => {
      const service = new DelhiveryService({ token: "test_token" });

      await expect(service.checkPincodeServiceability("012345")).rejects.toThrow(/Invalid pincode format/);
      await expect(service.checkPincodeServiceability("12345")).rejects.toThrow(/Invalid pincode format/);
      await expect(service.checkPincodeServiceability("1234567")).rejects.toThrow(/Invalid pincode format/);
      await expect(service.checkPincodeServiceability("ABCDEF")).rejects.toThrow(/Invalid pincode format/);
      await expect(service.checkPincodeServiceability("")).rejects.toThrow(/Pincode is required/);
    });

    test("should handle malformed vendor response gracefully", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => ({})
      });

      const service = new DelhiveryService({ token: "test_token", env: "staging" });
      const result = await service.checkPincodeServiceability("110001");

      expect(result).toEqual({
        serviceable: false,
        pincode: "110001",
        prepaidAvailable: false,
        codAvailable: false,
        message: "Pincode is not serviceable by Delhivery"
      });
    });
  });

  describe("Shipping Rate Calculation (Stage 2B)", () => {
    test("should calculate shipping rate successfully with valid inputs", async () => {
      const mockRateResponse = [
        {
          total_amount: 145.5,
          charge_DL: 120.0,
          charge_COD: 0,
          charge_FS: 25.5,
          status: "success",
          zone: "B"
        }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => mockRateResponse
      });

      const service = new DelhiveryService({
        token: "test_token",
        env: "staging",
        warehousePincode: "110001"
      });

      const result = await service.calculateShippingRate({
        destinationPincode: "400001",
        weightGrams: 800,
        paymentMode: "prepaid"
      });

      expect(result).toEqual({
        success: true,
        amount: 145.5,
        currency: "INR",
        estimated: true,
        chargeableWeightGrams: 800,
        zone: "B",
        breakdown: {
          freightCharge: 120.0,
          codCharge: 0,
          fuelSurcharge: 25.5
        }
      });
    });

    test("should compute volumetric weight correctly when dimensions produce higher chargeable weight", async () => {
      const mockRateResponse = [{ total_amount: 220, zone: "C" }];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => mockRateResponse
      });

      const service = new DelhiveryService({
        token: "test_token",
        warehousePincode: "110001"
      });

      const result = await service.calculateShippingRate({
        destinationPincode: "560001",
        weightGrams: 1000,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 15 }
      });

      expect(result.chargeableWeightGrams).toBe(1800);
      expect(result.amount).toBe(220);
    });

    test("should reject invalid destination pincode", async () => {
      const service = new DelhiveryService({ token: "test_token", warehousePincode: "110001" });

      await expect(
        service.calculateShippingRate({
          destinationPincode: "012345",
          weightGrams: 500
        })
      ).rejects.toThrow(/Destination pincode is required and must be a 6-digit number/);
    });

    test("should reject invalid weight", async () => {
      const service = new DelhiveryService({ token: "test_token", warehousePincode: "110001" });

      await expect(
        service.calculateShippingRate({
          destinationPincode: "400001",
          weightGrams: 0
        })
      ).rejects.toThrow(/Weight is required and must be a positive number/);
    });

    test("should reject invalid dimensions", async () => {
      const service = new DelhiveryService({ token: "test_token", warehousePincode: "110001" });

      await expect(
        service.calculateShippingRate({
          destinationPincode: "400001",
          weightGrams: 500,
          dimensions: { lengthCm: -10, widthCm: 20, heightCm: 15 }
        })
      ).rejects.toThrow(/Dimensions must contain positive numbers/);
    });
  });

  describe("Forward Shipment Creation & AWB Generation (Stage 2C)", () => {
    const mockOrder = {
      _id: "660c1f2b1a2b3c4d5e6f7a8b",
      orderNumber: "LYVO100204",
      paymentMethod: "card",
      pricing: { subtotal: 2999, shippingCost: 0, tax: 540, total: 3539 },
      shippingAddress: {
        fullName: "Rahul Sharma",
        phone: "9876543210",
        address: "Flat 402, Greenfield Heights",
        city: "Mumbai",
        state: "Maharashtra",
        zipCode: "400001",
        country: "India"
      },
      items: [
        { name: "LYVO Runner Pro", quantity: 1, price: 2999, size: "UK 9" }
      ],
      shipping: {
        waybill: "",
        packageDetails: { weightGrams: 1200, dimensions: { lengthCm: 34, widthCm: 24, heightCm: 13 } }
      }
    };

    test("should successfully create forward shipment and extract AWB", async () => {
      const mockCmuResponse = {
        cash_pickups_count: 0,
        package_count: 1,
        upload_wbn: "DELHIVERY_WBN_998877",
        replacement_count: 0,
        rmk: "Shipment manifested",
        cod_count: 0,
        success: true,
        packages: [
          {
            status: "Success",
            client: "LYVO_CLIENT",
            sort_code: "BOM/AND",
            remarks: [""],
            waybill: "1234567890123",
            cod_amount: 0,
            payment: "Pre-paid",
            service: "Express",
            order: "LYVO100204"
          }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => mockCmuResponse
      });

      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: "LYVO_PRIMARY_HUB",
        clientName: "LYVO_CLIENT"
      });

      const result = await service.createForwardShipment(mockOrder);

      expect(result.success).toBe(true);
      expect(result.waybill).toBe("1234567890123");
      expect(result.delhiveryStatus).toBe("Success");
      expect(result.pickupLocation).toBe("LYVO_PRIMARY_HUB");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = global.fetch.mock.calls[0];
      expect(calledUrl).toContain("/api/cmu/create.json");
      expect(calledOptions.method).toBe("POST");
      expect(calledOptions.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(calledOptions.body).toContain("format=json&data=");
      expect(decodeURIComponent(calledOptions.body)).toContain("LYVO100204");
      expect(decodeURIComponent(calledOptions.body)).toContain("LYVO_PRIMARY_HUB");
    });

    test("should prevent duplicate shipment creation if order already has an AWB", async () => {
      const orderWithWaybill = {
        ...mockOrder,
        shipping: {
          waybill: "EXISTING_AWB_112233"
        }
      };

      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: "LYVO_PRIMARY_HUB"
      });

      global.fetch = jest.fn();

      const result = await service.createForwardShipment(orderWithWaybill);

      expect(result.success).toBe(false);
      expect(result.duplicate).toBe(true);
      expect(result.waybill).toBe("EXISTING_AWB_112233");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should reject order missing shipping address", async () => {
      const invalidOrder = {
        ...mockOrder,
        shippingAddress: null
      };

      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: "LYVO_PRIMARY_HUB"
      });

      await expect(service.createForwardShipment(invalidOrder)).rejects.toThrow(
        /Order is missing shipping address details/
      );
    });

    test("should reject order with invalid PIN code", async () => {
      const invalidOrder = {
        ...mockOrder,
        shippingAddress: { ...mockOrder.shippingAddress, zipCode: "012345" }
      };

      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: "LYVO_PRIMARY_HUB"
      });

      await expect(service.createForwardShipment(invalidOrder)).rejects.toThrow(
        /Valid 6-digit destination PIN code is required/
      );
    });

    test("should reject order when warehouse name is not configured", async () => {
      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: ""
      });

      await expect(service.createForwardShipment(mockOrder)).rejects.toThrow(
        /DELHIVERY_WAREHOUSE_NAME is not configured/
      );
    });

    test("should handle Delhivery failure when packages[0].status is Fail", async () => {
      const failResponse = {
        success: true,
        packages: [
          {
            status: "Fail",
            remarks: ["Pincode not serviceable for express mode"]
          }
        ]
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => failResponse
      });

      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: "LYVO_PRIMARY_HUB"
      });

      await expect(service.createForwardShipment(mockOrder)).rejects.toThrow(
        /Delhivery Package Error: Pincode not serviceable/
      );
    });

    test("should handle Delhivery top-level success: false response", async () => {
      const failResponse = {
        success: false,
        rmk: "Pickup location LYVO_PRIMARY_HUB does not exist"
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => failResponse
      });

      const service = new DelhiveryService({
        token: "test_token",
        warehouseName: "LYVO_PRIMARY_HUB"
      });

      await expect(service.createForwardShipment(mockOrder)).rejects.toThrow(
        /Delhivery Shipment Creation Failed: Pickup location LYVO_PRIMARY_HUB does not exist/
      );
    });
  });

  describe("Health & Verification Flow", () => {
    test("should return healthy: false when token is missing", async () => {
      const service = new DelhiveryService({ token: "" });
      const health = await service.verifyHealth();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain("DELHIVERY_API_TOKEN is not configured");
    });

    test("should return healthy: true when mocked pincode API succeeds", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : null)
        },
        json: async () => ({ delivery_codes: [] })
      });

      const service = new DelhiveryService({
        token: "valid_token",
        env: "staging",
        warehousePincode: "110001"
      });
      const health = await service.verifyHealth();
      expect(health.healthy).toBe(true);
      expect(health.message).toBe("Delhivery API connected successfully");
    });
  });
});
