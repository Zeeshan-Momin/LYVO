const mongoose = require("mongoose");
const Order = require("../models/Order");
const RazorpaySettlement = require("../models/RazorpaySettlement");
const CourierInvoice = require("../models/CourierInvoice");

/**
 * Normalizes start and end dates with standard 30-day default and UTC boundaries
 */
function parseProfitabilityDateRange(startDate, endDate) {
  const end = endDate ? new Date(endDate) : new Date();
  if (typeof endDate === "string" && endDate.length <= 10) {
    end.setHours(23, 59, 59, 999);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (typeof startDate === "string" && startDate.length <= 10) {
    start.setHours(0, 0, 0, 0);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error("Invalid date parameter format");
    err.statusCode = 400;
    throw err;
  }

  if (start > end) {
    const err = new Error("Start date cannot be after end date");
    err.statusCode = 400;
    throw err;
  }

  return { start, end };
}

function round2(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

function round1(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Math.round((Number(val) + Number.EPSILON) * 10) / 10;
}

/**
 * 1. GET PRODUCT / SKU PROFITABILITY
 * Flow:
 *   GMS = Price * Quantity
 *   Net Merchandise Sales = GMS - Coupon Discount
 *   Net Revenue = Net Merchandise Sales - Refunds
 *   Gross Profit = Net Revenue - Total COGS
 */
async function getProductProfitability({
  startDate,
  endDate,
  page = 1,
  limit = 20,
  sortBy = "grossMerchandiseSales",
  sortDir = "desc",
  search = "",
  category = ""
} = {}) {
  const { start, end } = parseProfitabilityDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const pipeline = [
    { $match: matchFilter },
    { $unwind: "$items" }
  ];

  if (category && category !== "all") {
    pipeline.push({
      $match: { "items.category": category }
    });
  }

  if (search && search.trim()) {
    const q = search.trim();
    pipeline.push({
      $match: {
        $or: [
          { "items.name": { $regex: q, $options: "i" } },
          { "items.sku": { $regex: q, $options: "i" } }
        ]
      }
    });
  }

  pipeline.push(
    {
      $group: {
        _id: {
          product: "$items.product",
          sku: { $ifNull: ["$items.sku", ""] },
          name: "$items.name",
          category: { $ifNull: ["$items.category", "UNCLASSIFIED"] },
          gender: { $ifNull: ["$items.gender", "UNCLASSIFIED"] }
        },
        unitsSold: { $sum: "$items.quantity" },
        grossMerchandiseSales: {
          $sum: { $multiply: ["$items.price", "$items.quantity"] }
        },
        productDiscounts: {
          $sum: {
            $multiply: [
              { $max: [0, { $subtract: [{ $ifNull: ["$items.mrp", "$items.price"] }, "$items.price"] }] },
              "$items.quantity"
            ]
          }
        },
        couponAllocated: {
          $sum: { $ifNull: ["$items.allocatedCouponDiscount", 0] }
        },
        knownCogs: {
          $sum: {
            $cond: [
              { $eq: ["$items.costPriceSource", "actual"] },
              { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
              0
            ]
          }
        },
        estimatedCogs: {
          $sum: {
            $cond: [
              { $eq: ["$items.costPriceSource", "estimated"] },
              { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
              0
            ]
          }
        },
        unknownCostUnits: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ["$items.costPrice", null] }, { $eq: ["$items.costPriceSource", "unknown"] }] },
              "$items.quantity",
              0
            ]
          }
        },
        orderIds: { $addToSet: "$_id" }
      }
    }
  );

  const results = await Order.aggregate(pipeline);

  // Post-process metrics
  let totalUnits = 0;
  let totalGMS = 0;
  let totalCoupon = 0;
  let totalKnownCogs = 0;
  let totalEstCogs = 0;
  let totalUnknownCostUnits = 0;

  const processedProducts = results.map(row => {
    const unitsSold = row.unitsSold || 0;
    const gms = round2(row.grossMerchandiseSales);
    const productDiscounts = round2(row.productDiscounts);
    const couponAllocated = round2(row.couponAllocated);
    // Net Merchandise Sales = GMS - Coupon Discounts (Refunds NOT subtracted here)
    const netMerchandiseSales = round2(gms - couponAllocated);
    const refunds = 0; // Product item level direct refunds placeholder
    const netRevenue = round2(netMerchandiseSales - refunds);

    const knownCogs = round2(row.knownCogs);
    const estimatedCogs = round2(row.estimatedCogs);
    const totalCogs = round2(knownCogs + estimatedCogs);
    const unknownCostUnits = row.unknownCostUnits || 0;

    totalUnits += unitsSold;
    totalGMS += gms;
    totalCoupon += couponAllocated;
    totalKnownCogs += knownCogs;
    totalEstCogs += estimatedCogs;
    totalUnknownCostUnits += unknownCostUnits;

    const cogsCoveragePercent = unitsSold > 0
      ? Math.round(((unitsSold - unknownCostUnits) / unitsSold) * 100)
      : 100;

    const cogsStatus = unknownCostUnits > 0
      ? "incomplete"
      : (estimatedCogs > 0 ? "estimated" : "actual");

    const grossProfit = cogsStatus === "incomplete"
      ? null
      : round2(netRevenue - totalCogs);

    const grossMarginPercent = (grossProfit !== null && netRevenue > 0)
      ? round1((grossProfit / netRevenue) * 100)
      : null;

    let provenance = "ACTUAL";
    if (cogsStatus === "incomplete") {
      provenance = "UNKNOWN";
    } else if (cogsStatus === "estimated") {
      provenance = "ESTIMATED";
    } else {
      provenance = "DERIVED";
    }

    return {
      productId: row._id.product,
      sku: row._id.sku,
      name: row._id.name,
      category: row._id.category,
      gender: row._id.gender,
      unitsSold,
      orderCount: row.orderIds?.length || 0,
      grossMerchandiseSales: gms,
      productDiscounts,
      couponAllocated,
      netMerchandiseSales,
      refunds,
      netRevenue,
      knownCogs,
      estimatedCogs,
      totalCogs,
      unknownCostUnits,
      cogsCoveragePercent,
      cogsStatus,
      grossProfit,
      grossMarginPercent,
      provenance
    };
  });

  // Sorting
  const sortDirection = sortDir === "asc" ? 1 : -1;
  processedProducts.sort((a, b) => {
    const valA = a[sortBy] !== undefined && a[sortBy] !== null ? a[sortBy] : -Infinity;
    const valB = b[sortBy] !== undefined && b[sortBy] !== null ? b[sortBy] : -Infinity;
    return sortDirection === 1 ? valA - valB : valB - valA;
  });

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const totalRecords = processedProducts.length;
  const paginatedProducts = processedProducts.slice((pg - 1) * lim, pg * lim);

  const overallNetMerchandiseSales = round2(totalGMS - totalCoupon);
  const overallNetRevenue = overallNetMerchandiseSales; // (No refunds attributed at aggregate item row)
  const overallTotalCogs = round2(totalKnownCogs + totalEstCogs);
  const overallCogsCoverage = totalUnits > 0
    ? Math.round(((totalUnits - totalUnknownCostUnits) / totalUnits) * 100)
    : 100;
  const overallCogsStatus = totalUnknownCostUnits > 0
    ? "incomplete"
    : (totalEstCogs > 0 ? "estimated" : "actual");
  const overallGrossProfit = overallCogsStatus === "incomplete"
    ? null
    : round2(overallNetRevenue - overallTotalCogs);
  const overallGrossMargin = (overallGrossProfit !== null && overallNetRevenue > 0)
    ? round1((overallGrossProfit / overallNetRevenue) * 100)
    : null;

  return {
    dateRange: { start, end },
    summary: {
      totalProducts: totalRecords,
      totalUnitsSold: totalUnits,
      grossMerchandiseSales: round2(totalGMS),
      couponAllocated: round2(totalCoupon),
      netMerchandiseSales: overallNetMerchandiseSales,
      refunds: 0,
      netRevenue: overallNetRevenue,
      knownCogs: round2(totalKnownCogs),
      estimatedCogs: round2(totalEstCogs),
      totalCogs: overallTotalCogs,
      unknownCostUnits: totalUnknownCostUnits,
      cogsCoveragePercent: overallCogsCoverage,
      cogsStatus: overallCogsStatus,
      grossProfit: overallGrossProfit,
      grossMarginPercent: overallGrossMargin,
      provenance: overallGrossProfit !== null ? (overallCogsStatus === "estimated" ? "ESTIMATED" : "DERIVED") : "UNKNOWN"
    },
    products: paginatedProducts,
    pagination: {
      total: totalRecords,
      page: pg,
      limit: lim,
      pages: Math.ceil(totalRecords / lim) || 1
    }
  };
}

/**
 * 2. GET CATEGORY & GENDER PROFITABILITY
 */
async function getCategoryProfitability({ startDate, endDate } = {}) {
  const { start, end } = parseProfitabilityDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const [categoryAgg, genderAgg] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.category", "UNCLASSIFIED"] },
          unitsSold: { $sum: "$items.quantity" },
          grossMerchandiseSales: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] }
          },
          couponAllocated: {
            $sum: { $ifNull: ["$items.allocatedCouponDiscount", 0] }
          },
          knownCogs: {
            $sum: {
              $cond: [
                { $eq: ["$items.costPriceSource", "actual"] },
                { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
                0
              ]
            }
          },
          estimatedCogs: {
            $sum: {
              $cond: [
                { $eq: ["$items.costPriceSource", "estimated"] },
                { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
                0
              ]
            }
          },
          unknownCostUnits: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$items.costPrice", null] }, { $eq: ["$items.costPriceSource", "unknown"] }] },
                "$items.quantity",
                0
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { grossMerchandiseSales: -1 } }
    ]),
    Order.aggregate([
      { $match: matchFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.gender", "UNCLASSIFIED"] },
          unitsSold: { $sum: "$items.quantity" },
          grossMerchandiseSales: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] }
          },
          couponAllocated: {
            $sum: { $ifNull: ["$items.allocatedCouponDiscount", 0] }
          },
          knownCogs: {
            $sum: {
              $cond: [
                { $eq: ["$items.costPriceSource", "actual"] },
                { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
                0
              ]
            }
          },
          estimatedCogs: {
            $sum: {
              $cond: [
                { $eq: ["$items.costPriceSource", "estimated"] },
                { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
                0
              ]
            }
          },
          unknownCostUnits: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$items.costPrice", null] }, { $eq: ["$items.costPriceSource", "unknown"] }] },
                "$items.quantity",
                0
              ]
            }
          },
          orderCount: { $addToSet: "$_id" }
        }
      },
      { $sort: { grossMerchandiseSales: -1 } }
    ])
  ]);

  const mapProfitabilityGroup = (group, keyName) => {
    return group.map(row => {
      const name = row._id || "UNCLASSIFIED";
      const unitsSold = row.unitsSold || 0;
      const gms = round2(row.grossMerchandiseSales);
      const coupon = round2(row.couponAllocated);
      // Net Merchandise Sales = GMS - Coupon Discount
      const netMerchandiseSales = round2(gms - coupon);
      const refunds = 0;
      const netRevenue = round2(netMerchandiseSales - refunds);

      const knownCogs = round2(row.knownCogs);
      const estimatedCogs = round2(row.estimatedCogs);
      const totalCogs = round2(knownCogs + estimatedCogs);
      const unknownUnits = row.unknownCostUnits || 0;

      const cogsCoveragePercent = unitsSold > 0
        ? Math.round(((unitsSold - unknownUnits) / unitsSold) * 100)
        : 100;

      const cogsStatus = unknownUnits > 0
        ? "incomplete"
        : (estimatedCogs > 0 ? "estimated" : "actual");

      const grossProfit = cogsStatus === "incomplete"
        ? null
        : round2(netRevenue - totalCogs);

      const grossMarginPercent = (grossProfit !== null && netRevenue > 0)
        ? round1((grossProfit / netRevenue) * 100)
        : null;

      let provenance = "ACTUAL";
      if (cogsStatus === "incomplete") {
        provenance = "UNKNOWN";
      } else if (cogsStatus === "estimated") {
        provenance = "ESTIMATED";
      } else {
        provenance = "DERIVED";
      }

      return {
        [keyName]: name,
        unitsSold,
        orderCount: row.orderCount?.length || 0,
        grossMerchandiseSales: gms,
        couponAllocated: coupon,
        netMerchandiseSales,
        refunds,
        netRevenue,
        knownCogs,
        estimatedCogs,
        totalCogs,
        unknownCostUnits: unknownUnits,
        cogsCoveragePercent,
        cogsStatus,
        grossProfit,
        grossMarginPercent,
        provenance
      };
    });
  };

  const byCategory = mapProfitabilityGroup(categoryAgg, "category");
  const byGender = mapProfitabilityGroup(genderAgg, "gender");

  return {
    dateRange: { start, end },
    byCategory,
    byGender,
    disclosures: [
      "Category and Gender metrics are derived from immutable historical order item snapshots.",
      "GMS - Coupon Discounts = Net Merchandise Sales. Net Revenue = Net Merchandise Sales - Refunds.",
      "If a historical item has missing or unknown costPrice, Gross Profit for that segment is reported as incomplete/UNKNOWN."
    ]
  };
}

/**
 * 3. GET PAYMENT CHANNEL / METHOD PROFITABILITY
 * Flow:
 *   GMS - Coupon Discounts = Net Merchandise Sales
 *   Net Merchandise Sales + Shipping Revenue - Actual Refunds = Net Revenue
 *   Net Revenue - Total COGS = Gross Profit
 *   Gross Profit - Gateway Fees - Freight Cost = Contribution Profit
 */
async function getChannelProfitability({ startDate, endDate } = {}) {
  const { start, end } = parseProfitabilityDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const [channelAgg, settlementsSum, courierSum] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      {
        $project: {
          isPrepaid: { $in: ["$paymentMethod", ["card", "upi", "netbanking", "wallet"]] },
          isPaid: 1,
          status: 1,
          pricing: 1,
          items: 1,
          totalRefundedAmount: { $ifNull: ["$totalRefundedAmount", 0] },
          gatewaySettlement: 1,
          shippingSettlement: 1
        }
      },
      {
        $group: {
          _id: { $cond: ["$isPrepaid", "prepaid", "cod"] },
          totalOrders: { $sum: 1 },
          paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
          returnedOrders: { $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, 1, 0] } },
          grossSales: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
              }
            }
          },
          couponDiscounts: { $sum: { $ifNull: ["$pricing.couponDiscount", 0] } },
          shippingCollected: { $sum: { $ifNull: ["$pricing.shippingCost", 0] } },
          refundsValue: { $sum: "$totalRefundedAmount" },
          knownCogs: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $eq: ["$$this.costPriceSource", "actual"] },
                        { $multiply: [{ $ifNull: ["$$this.costPrice", 0] }, "$$this.quantity"] },
                        0
                      ]
                    }
                  ]
                }
              }
            }
          },
          estimatedCogs: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $eq: ["$$this.costPriceSource", "estimated"] },
                        { $multiply: [{ $ifNull: ["$$this.costPrice", 0] }, "$$this.quantity"] },
                        0
                      ]
                    }
                  ]
                }
              }
            }
          },
          unknownCostUnits: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $or: [{ $eq: ["$$this.costPrice", null] }, { $eq: ["$$this.costPriceSource", "unknown"] }] },
                        "$$this.quantity",
                        0
                      ]
                    }
                  ]
                }
              }
            }
          },
          totalUnitsSold: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.quantity"] }
              }
            }
          },
          recordedGatewayFees: {
            $sum: { $ifNull: ["$gatewaySettlement.fee", 0] }
          },
          recordedGatewayTaxes: {
            $sum: { $ifNull: ["$gatewaySettlement.tax", 0] }
          },
          recordedFreightCost: {
            $sum: { $ifNull: ["$shippingSettlement.actualFreightCost", 0] }
          }
        }
      }
    ]),
    RazorpaySettlement.aggregate([
      { $match: { settlementDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalFees: { $sum: "$feeAmount" },
          totalTax: { $sum: "$taxAmount" },
          count: { $sum: 1 }
        }
      }
    ]),
    CourierInvoice.aggregate([
      { $match: { invoiceDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalActualFreight: { $sum: "$reconciliationSummary.totalActualFreight" },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const settlementGlobal = settlementsSum[0] || { totalFees: 0, totalTax: 0, count: 0 };

  const channels = channelAgg.map(ch => {
    const channelName = ch._id;
    const isPrepaid = channelName === "prepaid";

    const grossMerchandiseSales = round2(ch.grossSales);
    const couponDiscounts = round2(ch.couponDiscounts);
    const netMerchandiseSales = round2(grossMerchandiseSales - couponDiscounts);
    const shippingRevenue = round2(ch.shippingCollected);
    const refunds = round2(ch.refundsValue);
    // Correct revenue flow: Net Merchandise Sales + Shipping Revenue - Actual Refunds
    const netRevenue = round2(netMerchandiseSales + shippingRevenue - refunds);

    const knownCogs = round2(ch.knownCogs);
    const estimatedCogs = round2(ch.estimatedCogs);
    const totalCogs = round2(knownCogs + estimatedCogs);
    const unknownUnits = ch.unknownCostUnits || 0;
    const totalUnits = ch.totalUnitsSold || 0;

    const cogsCoveragePercent = totalUnits > 0
      ? Math.round(((totalUnits - unknownUnits) / totalUnits) * 100)
      : 100;

    const cogsStatus = unknownUnits > 0
      ? "incomplete"
      : (estimatedCogs > 0 ? "estimated" : "actual");

    // Gross Profit = Net Revenue - Total COGS
    const grossProfit = cogsStatus === "incomplete"
      ? null
      : round2(netRevenue - totalCogs);

    const grossMarginPercent = (grossProfit !== null && netRevenue > 0)
      ? round1((grossProfit / netRevenue) * 100)
      : null;

    // Gateway Fee determination
    let gatewayFee = null;
    let gatewayFeeProvenance = "UNKNOWN";

    if (!isPrepaid) {
      gatewayFee = 0;
      gatewayFeeProvenance = "NOT_APPLICABLE";
    } else {
      if (ch.recordedGatewayFees > 0) {
        gatewayFee = round2(ch.recordedGatewayFees);
        gatewayFeeProvenance = "ACTUAL";
      } else if (settlementGlobal.count > 0 && settlementGlobal.totalFees > 0) {
        gatewayFee = round2(settlementGlobal.totalFees);
        gatewayFeeProvenance = "ACTUAL";
      } else {
        gatewayFee = null;
        gatewayFeeProvenance = "UNKNOWN";
      }
    }

    // Freight determination
    let freightCost = null;
    let freightProvenance = "UNKNOWN";

    if (ch.recordedFreightCost > 0) {
      freightCost = round2(ch.recordedFreightCost);
      freightProvenance = "ACTUAL";
    } else {
      freightCost = null;
      freightProvenance = "UNKNOWN";
    }

    // Contribution profit = Gross Profit - Gateway Fee - Freight Cost
    let contributionProfit = null;
    let contributionMarginPercent = null;
    let contributionProvenance = "UNKNOWN";

    if (grossProfit !== null && gatewayFee !== null && freightCost !== null) {
      contributionProfit = round2(grossProfit - gatewayFee - freightCost);
      contributionMarginPercent = netRevenue > 0 ? round1((contributionProfit / netRevenue) * 100) : null;
      contributionProvenance = "DERIVED";
    }

    return {
      channel: channelName,
      channelLabel: isPrepaid ? "Prepaid (Card/UPI/NetBanking)" : "Cash On Delivery (COD)",
      orderCount: ch.totalOrders,
      paidOrderCount: ch.paidOrders,
      deliveredCount: ch.deliveredOrders,
      returnedCount: ch.returnedOrders,
      grossMerchandiseSales,
      couponDiscounts,
      netMerchandiseSales,
      shippingRevenue,
      refunds,
      netRevenue,
      knownCogs,
      estimatedCogs,
      totalCogs,
      unknownCostUnits: unknownUnits,
      cogsCoveragePercent,
      cogsStatus,
      grossProfit,
      grossMarginPercent,
      gatewayFee,
      gatewayFeeProvenance,
      freightCost,
      freightProvenance,
      contributionProfit,
      contributionMarginPercent,
      contributionProvenance
    };
  });

  return {
    dateRange: { start, end },
    channels,
    disclosures: [
      "Revenue flow: GMS - Coupon Discounts = Net Merchandise Sales. Net Revenue = Net Merchandise Sales + Shipping Revenue - Actual Refunds.",
      "Gross Profit = Net Revenue - Total COGS. Contribution Profit = Gross Profit - Gateway Fees - Freight.",
      "Gateway fees for prepaid orders reflect actual recorded settlement fees. If settlements have not been imported, gateway fees are reported as UNKNOWN.",
      "Courier freight reflects reconciled freight invoices. Freight is never assumed to be ₹0."
    ]
  };
}

/**
 * 4. GET ORDER UNIT ECONOMICS BREAKDOWN
 * Revenue Flow:
 *   GMS
 *   - Coupon Discount
 *   = Net Merchandise Sales
 *   + Shipping Revenue
 *   - Actual Refunds
 *   = Net Revenue
 *   - Total COGS
 *   = Gross Profit
 *   - Gateway Fee
 *   - Freight Cost
 *   = Contribution Profit
 */
async function getOrderUnitEconomics(orderIdOrNumber) {
  if (!orderIdOrNumber) {
    const err = new Error("Order ID or order number is required");
    err.statusCode = 400;
    throw err;
  }

  const query = mongoose.Types.ObjectId.isValid(orderIdOrNumber)
    ? { _id: orderIdOrNumber }
    : { orderNumber: String(orderIdOrNumber).trim() };

  const order = await Order.findOne(query)
    .populate("user", "name email phone")
    .lean();

  if (!order) {
    const err = new Error("Order record not found");
    err.statusCode = 404;
    throw err;
  }

  // 1. Process Line Items
  let totalKnownCogs = 0;
  let totalEstCogs = 0;
  let unknownCostCount = 0;
  let totalGMS = 0;
  let totalCouponAllocated = 0;

  const processedItems = (order.items || []).map(item => {
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const mrp = item.mrp || price;
    const grossAmount = round2(price * qty);
    const itemDiscount = round2(Math.max(0, mrp - price) * qty);
    const allocatedCoupon = round2(item.allocatedCouponDiscount || 0);
    const netItemMerchandiseSales = round2(grossAmount - allocatedCoupon);

    totalGMS += grossAmount;
    totalCouponAllocated += allocatedCoupon;

    const costPrice = item.costPrice;
    const costSource = (item.costPriceSource || "unknown").toLowerCase();

    let itemCogs = null;
    let itemGrossProfit = null;
    let itemGrossMargin = null;

    if (costPrice !== null && costPrice !== undefined && !isNaN(costPrice)) {
      itemCogs = round2(Number(costPrice) * qty);
      if (costSource === "actual") {
        totalKnownCogs += itemCogs;
      } else {
        totalEstCogs += itemCogs;
      }
      itemGrossProfit = round2(netItemMerchandiseSales - itemCogs);
      itemGrossMargin = netItemMerchandiseSales > 0 ? round1((itemGrossProfit / netItemMerchandiseSales) * 100) : null;
    } else {
      unknownCostCount += qty;
    }

    return {
      productId: item.product,
      name: item.name,
      sku: item.sku || "",
      category: item.category || "UNCLASSIFIED",
      gender: item.gender || "UNCLASSIFIED",
      size: item.size || "",
      color: item.color || "",
      quantity: qty,
      price,
      mrp,
      grossAmount,
      itemDiscount,
      allocatedCouponDiscount: allocatedCoupon,
      netMerchandiseSales: netItemMerchandiseSales,
      costPrice: costPrice !== null && costPrice !== undefined ? Number(costPrice) : null,
      costPriceSource: costSource,
      cogs: itemCogs,
      grossProfit: itemGrossProfit,
      grossMarginPercent: itemGrossMargin,
      provenance: costPrice !== null ? (costSource === "actual" ? "ACTUAL" : "ESTIMATED") : "UNKNOWN"
    };
  });

  // 2. Financial Overview & Revenue Flow Alignment
  const pricing = order.pricing || {};
  const grossMerchandiseSales = round2(pricing.subtotal || totalGMS);
  const couponDiscount = round2(pricing.couponDiscount || totalCouponAllocated);
  const netMerchandiseSales = round2(grossMerchandiseSales - couponDiscount);
  const shippingRevenue = round2(pricing.shippingCost || 0);
  const refunds = round2(order.totalRefundedAmount || 0);
  // Net Revenue = Net Merchandise Sales + Shipping Revenue - Actual Refunds
  const netRevenue = round2(netMerchandiseSales + shippingRevenue - refunds);

  const taxCollected = round2(pricing.tax || 0); // Excluded from revenue
  const totalCustomerPaid = round2(pricing.total || (netMerchandiseSales + shippingRevenue + taxCollected));

  // 3. COGS Aggregation
  const totalCogs = unknownCostCount > 0 ? null : round2(totalKnownCogs + totalEstCogs);
  let cogsStatus = "complete_actual";
  let cogsProvenance = "ACTUAL";

  if (unknownCostCount > 0) {
    cogsStatus = "incomplete";
    cogsProvenance = "UNKNOWN";
  } else if (totalEstCogs > 0) {
    cogsStatus = totalKnownCogs > 0 ? "partially_estimated" : "fully_estimated";
    cogsProvenance = "ESTIMATED";
  }

  // 4. Gross Profit = Net Revenue - Total COGS
  const grossProfit = cogsStatus === "incomplete" ? null : round2(netRevenue - totalCogs);
  const grossMarginPercent = (grossProfit !== null && netRevenue > 0)
    ? round1((grossProfit / netRevenue) * 100)
    : null;

  // 5. Gateway Fee Resolution
  let gatewayFee = null;
  let gatewayTax = null;
  let gatewayProvenance = "UNKNOWN";

  if (order.paymentMethod === "cod") {
    gatewayFee = 0;
    gatewayTax = 0;
    gatewayProvenance = "NOT_APPLICABLE";
  } else {
    // Check order embedded settlement stub
    if (order.gatewaySettlement?.fee !== null && order.gatewaySettlement?.fee !== undefined) {
      gatewayFee = round2(order.gatewaySettlement.fee);
      gatewayTax = round2(order.gatewaySettlement.tax || 0);
      gatewayProvenance = (order.gatewaySettlement.feeSource || "actual").toUpperCase();
    } else if (order.razorpayPaymentId) {
      // Lookup in imported settlements
      const settlementMatch = await RazorpaySettlement.findOne(
        { "transactions.paymentId": order.razorpayPaymentId },
        { "transactions.$": 1 }
      ).lean();

      if (settlementMatch?.transactions?.[0]) {
        gatewayFee = round2(settlementMatch.transactions[0].fee);
        gatewayTax = round2(settlementMatch.transactions[0].tax || 0);
        gatewayProvenance = "ACTUAL";
      }
    }
  }

  // 6. Courier Freight Resolution
  let freightCost = null;
  let freightProvenance = "UNKNOWN";
  let fuelSurcharge = 0;
  let codHandling = 0;
  let rtoCost = 0;

  if (order.shippingSettlement?.actualFreightCost !== null && order.shippingSettlement?.actualFreightCost !== undefined) {
    freightCost = round2(order.shippingSettlement.actualFreightCost);
    fuelSurcharge = round2(order.shippingSettlement.fuelSurcharge || 0);
    codHandling = round2(order.shippingSettlement.codHandlingFee || 0);
    rtoCost = round2(order.shippingSettlement.rtoCost || 0);
    freightProvenance = "ACTUAL";
  } else if (order.shipping?.waybill) {
    // Lookup in imported courier invoices
    const invoiceMatch = await CourierInvoice.findOne(
      { "lineItems.waybill": order.shipping.waybill },
      { "lineItems.$": 1 }
    ).lean();

    if (invoiceMatch?.lineItems?.[0]) {
      const line = invoiceMatch.lineItems[0];
      freightCost = round2(line.freight || line.totalCarrierCharge);
      fuelSurcharge = round2(line.fuelSurcharge || 0);
      codHandling = round2(line.codHandling || 0);
      rtoCost = round2(line.rtoFreight || 0);
      freightProvenance = "ACTUAL";
    }
  }

  const totalFreightCarrierCharges = freightCost !== null
    ? round2(freightCost + fuelSurcharge + codHandling + rtoCost)
    : null;

  // 7. Order Contribution Profit = Gross Profit - Gateway Fee - Total Freight Charges
  let contributionProfit = null;
  let contributionMarginPercent = null;
  let contributionProvenance = "UNKNOWN";

  if (
    grossProfit !== null &&
    gatewayFee !== null &&
    totalFreightCarrierCharges !== null
  ) {
    contributionProfit = round2(grossProfit - gatewayFee - totalFreightCarrierCharges);
    contributionMarginPercent = netRevenue > 0 ? round1((contributionProfit / netRevenue) * 100) : null;
    contributionProvenance = (cogsProvenance === "ESTIMATED" || gatewayProvenance === "ESTIMATED")
      ? "ESTIMATED"
      : "DERIVED";
  }

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    status: order.status,
    isPaid: order.isPaid,
    paymentMethod: order.paymentMethod,
    customer: {
      name: order.shippingAddress?.fullName || order.user?.name || "Customer",
      city: order.shippingAddress?.city || "",
      state: order.shippingAddress?.state || ""
    },
    revenue: {
      grossMerchandiseSales,
      productDiscounts: round2(pricing.subtotal ? totalGMS - pricing.subtotal : 0),
      couponDiscount,
      netMerchandiseSales,
      shippingRevenue,
      refunds,
      netRevenue,
      taxCollected, // Held in trust, excluded from revenue
      totalCustomerPaid,
      provenance: "ACTUAL"
    },
    cogs: {
      knownCogs: round2(totalKnownCogs),
      estimatedCogs: round2(totalEstCogs),
      totalCogs,
      unknownCostUnits: unknownCostCount,
      cogsStatus,
      provenance: cogsProvenance
    },
    grossProfit: {
      amount: grossProfit,
      marginPercent: grossMarginPercent,
      provenance: grossProfit !== null ? "DERIVED" : "UNKNOWN"
    },
    gatewayEconomics: {
      fee: gatewayFee,
      tax: gatewayTax,
      provenance: gatewayProvenance
    },
    logisticsEconomics: {
      waybill: order.shipping?.waybill || "",
      freight: freightCost,
      fuelSurcharge,
      codHandling,
      rtoCost,
      totalFreight: totalFreightCarrierCharges,
      provenance: freightProvenance
    },
    contribution: {
      profit: contributionProfit,
      marginPercent: contributionMarginPercent,
      isComplete: contributionProfit !== null,
      provenance: contributionProvenance
    },
    items: processedItems,
    refunds: (order.refunds || []).map(r => ({
      refundId: r.refundId,
      amount: r.amount,
      type: r.type,
      reason: r.reason,
      status: r.status,
      processedAt: r.processedAt
    })),
    disclosures: [
      "Tax collected on sales (₹" + taxCollected.toLocaleString() + ") is held in trust for statutory GST remittance and is excluded from revenue.",
      "GMS - Coupon Discount = Net Merchandise Sales. Net Revenue = Net Merchandise Sales + Shipping Revenue - Actual Refunds.",
      cogsStatus === "incomplete"
        ? "One or more order items lack recorded cost price; Gross Profit is flagged UNKNOWN."
        : "COGS is calculated using immutable order line snapshots.",
      gatewayProvenance === "UNKNOWN"
        ? "Razorpay settlement for this payment ID has not been imported yet."
        : "Gateway fee verified from payment settlement records.",
      freightProvenance === "UNKNOWN"
        ? "Courier invoice for this waybill has not been imported yet."
        : "Carrier freight verified from courier billing invoice."
    ]
  };
}

module.exports = {
  getProductProfitability,
  getCategoryProfitability,
  getChannelProfitability,
  getOrderUnitEconomics
};
