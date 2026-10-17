const ah = require("express-async-handler");
const delhiveryService = require("../services/delhiveryService");

/**
 * @desc    Check Delhivery API health & credentials
 * @route   GET /api/shipping/health
 * @access  Private/Admin
 */
exports.getShippingHealth = ah(async (req, res) => {
  const health = await delhiveryService.verifyHealth();

  if (!health.healthy) {
    return res.status(health.statusCode === 401 ? 401 : 503).json({
      success: false,
      ...health
    });
  }

  res.status(200).json({
    success: true,
    ...health
  });
});

/**
 * @desc    Check Delhivery pincode serviceability
 * @route   GET /api/shipping/pincode/:pincode
 * @access  Public
 */
exports.checkPincodeServiceability = ah(async (req, res) => {
  const { pincode } = req.params;

  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode.trim())) {
    return res.status(400).json({
      success: false,
      message: "Invalid pincode format. Must be a 6-digit number not starting with 0."
    });
  }

  try {
    const result = await delhiveryService.checkPincodeServiceability(pincode.trim());
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to check pincode serviceability"
    });
  }
});

/**
 * @desc    Calculate shipping charges / rate estimation
 * @route   POST /api/shipping/calculate-rate
 * @access  Public / Backend
 */
exports.calculateShippingRate = ah(async (req, res) => {
  const {
    originPincode,
    destinationPincode,
    weightGrams,
    dimensions,
    paymentMode,
    mode
  } = req.body || {};

  try {
    const result = await delhiveryService.calculateShippingRate({
      originPincode,
      destinationPincode,
      weightGrams,
      dimensions,
      paymentMode,
      mode
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to calculate shipping rate"
    });
  }
});

/**
 * @desc    Create Delhivery forward shipment & manifest AWB for an order
 * @route   POST /api/shipping/admin/shipment/:orderId
 * @access  Private/Admin
 */
exports.createShipmentForOrder = ah(async (req, res) => {
  const { orderId } = req.params;
  const Order = require("../models/Order");

  const order = await Order.findById(orderId).populate("user", "name email phone");
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (order.shipping?.waybill) {
    return res.status(400).json({
      success: false,
      message: `Shipment already created for this order with AWB ${order.shipping.waybill}`,
      waybill: order.shipping.waybill
    });
  }

  if (["cancelled", "refunded", "returned"].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot dispatch an order with status "${order.status}"`
    });
  }

  const result = await delhiveryService.createForwardShipment(order);

  if (!result.success && result.duplicate) {
    return res.status(400).json({
      success: false,
      message: result.message,
      waybill: result.waybill
    });
  }

  // Update order with shipping metadata
  order.shipping = {
    courier: "delhivery",
    waybill: result.waybill,
    shipmentId: result.shipmentId || order.orderNumber,
    pickupLocation: result.pickupLocation || delhiveryService.warehouseName,
    labelUrl: order.shipping?.labelUrl || "",
    delhiveryStatus: result.delhiveryStatus || "Manifested",
    delhiveryStatusCode: result.delhiveryStatusCode || "MAN",
    expectedDeliveryDate: order.shipping?.expectedDeliveryDate || null,
    packageDetails: order.shipping?.packageDetails || { weightGrams: 1200, dimensions: { lengthCm: 34, widthCm: 24, heightCm: 13 } },
    scans: [
      ...(order.shipping?.scans || []),
      {
        status: "Manifested",
        statusCode: "MAN",
        location: result.pickupLocation || delhiveryService.warehouseName,
        timestamp: new Date(),
        activity: "Shipment manifested with Delhivery"
      }
    ]
  };

  if (!order.trackingNumber) {
    order.trackingNumber = result.waybill;
  }

  if (order.status === "pending" || order.status === "confirmed") {
    order.status = "processing";
  }

  order.statusHistory.push({
    status: order.status,
    note: `Delhivery shipment created. AWB: ${result.waybill}`,
    updatedBy: req.user._id
  });

  await order.save();

  const cache = require("../utils/cache");
  cache.clear();

  res.status(200).json({
    success: true,
    message: "Delhivery shipment manifested successfully",
    waybill: result.waybill,
    shipmentId: result.shipmentId,
    delhiveryStatus: result.delhiveryStatus,
    order
  });
});
