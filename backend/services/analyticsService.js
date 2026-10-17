const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");

/**
 * Normalizes start and end dates with sensible defaults (last 30 days)
 */
function parseDateRange(startDate, endDate) {
  const end = endDate ? new Date(endDate) : new Date();
  // Set to end of the day if date string only
  if (endDate && endDate.length <= 10) {
    end.setHours(23, 59, 59, 999);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (startDate && startDate.length <= 10) {
    start.setHours(0, 0, 0, 0);
  }

  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd, durationMs };
}

/**
 * 1. Overview Analytics Aggregation
 */
async function getOverviewAnalytics({ startDate, endDate } = {}) {
  const { start, end, prevStart, prevEnd } = parseDateRange(startDate, endDate);

  // Common match for non-cancelled and completed orders
  const baseMatch = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const prevMatch = {
    createdAt: { $gte: prevStart, $lte: prevEnd },
    status: { $ne: "cancelled" }
  };

  // Pipeline for primary financial metrics
  const financialPipeline = (matchCondition) => [
    { $match: matchCondition },
    {
      $project: {
        orderNumber: 1,
        user: 1,
        status: 1,
        createdAt: 1,
        isPaid: 1,
        pricing: 1,
        financialSnapshot: 1,
        totalRefundedAmount: 1,
        refunds: 1,
        items: 1,
        // GMS: items subtotal or items price * quantity
        itemGMS: {
          $reduce: {
            input: "$items",
            initialValue: 0,
            in: { $add: ["$$value", { $multiply: [{ $ifNull: ["$$this.price", 0] }, { $ifNull: ["$$this.quantity", 1] }] }] }
          }
        },
        itemUnits: {
          $reduce: {
            input: "$items",
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 1] }] }
          }
        },
        // Product Markdowns / Discounts
        productMarkdownTotal: {
          $reduce: {
            input: "$items",
            initialValue: 0,
            in: { $add: ["$$value", { $multiply: [{ $ifNull: ["$$this.itemDiscount", 0] }, { $ifNull: ["$$this.quantity", 1] }] }] }
          }
        },
        // Coupon discount
        couponDiscount: { $ifNull: ["$pricing.couponDiscount", 0] },
        shippingRevenue: { $ifNull: ["$pricing.shippingCost", 0] },
        taxCollected: { $ifNull: ["$pricing.tax", 0] },
        // Actual refunds: totalRefundedAmount or sum of refunds array, fallback to total if refunded status
        refundAmount: {
          $cond: [
            { $gt: ["$totalRefundedAmount", 0] },
            "$totalRefundedAmount",
            {
              $cond: [
                { $eq: ["$status", "refunded"] },
                { $ifNull: ["$pricing.total", 0] },
                0
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        orderCount: { $sum: 1 },
        totalUnits: { $sum: "$itemUnits" },
        grossMerchandiseSales: { $sum: "$itemGMS" },
        productMarkdowns: { $sum: "$productMarkdownTotal" },
        couponDiscounts: { $sum: "$couponDiscount" },
        shippingRevenue: { $sum: "$shippingRevenue" },
        taxCollected: { $sum: "$taxCollected" },
        totalRefunds: { $sum: "$refundAmount" },
        uniqueCustomers: { $addToSet: "$user" }
      }
    },
    {
      $project: {
        _id: 0,
        orderCount: 1,
        totalUnits: 1,
        grossMerchandiseSales: 1,
        productMarkdowns: 1,
        couponDiscounts: 1,
        netMerchandiseSales: { $max: [0, { $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }] },
        shippingRevenue: 1,
        taxCollected: 1,
        totalRefunds: 1,
        netSales: {
          $subtract: [
            { $add: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$shippingRevenue"] },
            "$totalRefunds"
          ]
        },
        uniqueCustomerCount: { $size: "$uniqueCustomers" },
        aov: {
          $cond: [
            { $gt: ["$orderCount", 0] },
            { $divide: [{ $subtract: [{ $add: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$shippingRevenue"] }, "$totalRefunds"] }, "$orderCount"] },
            0
          ]
        }
      }
    }
  ];

  // Pipeline for time-series trend line
  const timeSeriesPipeline = [
    { $match: baseMatch },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
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
        shippingRevenue: { $sum: { $ifNull: ["$pricing.shippingCost", 0] } },
        refunds: { $sum: { $ifNull: ["$totalRefundedAmount", 0] } },
        orders: { $sum: 1 },
        units: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.quantity"] }
            }
          }
        }
      }
    },
    {
      $project: {
        date: "$_id",
        orders: 1,
        units: 1,
        grossSales: 1,
        netSales: {
          $subtract: [{ $add: [{ $subtract: ["$grossSales", "$couponDiscounts"] }, "$shippingRevenue"] }, "$refunds"]
        }
      }
    },
    { $sort: { date: 1 } }
  ];

  // Pipeline for orders by status
  const statusPipeline = [
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$pricing.total" } } },
    { $sort: { count: -1 } }
  ];

  // Top products pipeline
  const topProductsPipeline = [
    { $match: baseMatch },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        image: { $first: "$items.image" },
        category: {
          $first: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $ifNull: ["$items.category", ""] }, ""] },
                  { $ne: ["$items.category", null] }
                ]
              },
              "$items.category",
              "Footwear"
            ]
          }
        },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
      }
    },
    { $sort: { unitsSold: -1 } },
    { $limit: 6 }
  ];

  const [currentMetrics, prevMetrics, timeSeries, statusBreakdown, topProducts] = await Promise.all([
    Order.aggregate(financialPipeline(baseMatch)),
    Order.aggregate(financialPipeline(prevMatch)),
    Order.aggregate(timeSeriesPipeline),
    Order.aggregate(statusPipeline),
    Order.aggregate(topProductsPipeline)
  ]);

  const current = currentMetrics[0] || {
    orderCount: 0,
    totalUnits: 0,
    grossMerchandiseSales: 0,
    productMarkdowns: 0,
    couponDiscounts: 0,
    netMerchandiseSales: 0,
    shippingRevenue: 0,
    taxCollected: 0,
    totalRefunds: 0,
    netSales: 0,
    uniqueCustomerCount: 0,
    aov: 0
  };

  const prev = prevMetrics[0] || {
    orderCount: 0,
    totalUnits: 0,
    grossMerchandiseSales: 0,
    netSales: 0,
    aov: 0,
    uniqueCustomerCount: 0
  };

  // Compute percentage changes
  const calcChange = (curr, previous) => {
    if (!previous || previous === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - previous) / previous) * 1000) / 10;
  };

  const comparison = {
    grossSalesChange: calcChange(current.grossMerchandiseSales, prev.grossMerchandiseSales),
    netSalesChange: calcChange(current.netSales, prev.netSales),
    ordersChange: calcChange(current.orderCount, prev.orderCount),
    unitsChange: calcChange(current.totalUnits, prev.totalUnits),
    aovChange: calcChange(current.aov, prev.aov),
    customersChange: calcChange(current.uniqueCustomerCount, prev.uniqueCustomerCount)
  };

  return {
    dateRange: { start, end, prevStart, prevEnd },
    kpis: {
      ...current,
      aov: Math.round(current.aov)
    },
    comparison,
    timeSeries,
    statusBreakdown,
    topProducts
  };
}

/**
 * 2. Sales Analytics Aggregation (Detailed time-series + multi-dimensional breakdowns)
 */
async function getSalesAnalytics({ startDate, endDate, interval = "day", category, gender, paymentMethod } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  if (paymentMethod) {
    matchFilter.paymentMethod = paymentMethod;
  }

  // Format string for date interval
  let dateFormat = "%Y-%m-%d";
  if (interval === "week") dateFormat = "%Y-W%V";
  if (interval === "month") dateFormat = "%Y-%m";

  const timeSeriesPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        orders: { $sum: 1 },
        grossMerchandiseSales: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
            }
          }
        },
        unitsSold: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.quantity"] }
            }
          }
        },
        couponDiscounts: { $sum: { $ifNull: ["$pricing.couponDiscount", 0] } },
        shippingRevenue: { $sum: { $ifNull: ["$pricing.shippingCost", 0] } },
        taxCollected: { $sum: { $ifNull: ["$pricing.tax", 0] } },
        refunds: { $sum: { $ifNull: ["$totalRefundedAmount", 0] } }
      }
    },
    {
      $project: {
        date: "$_id",
        orders: 1,
        unitsSold: 1,
        grossMerchandiseSales: 1,
        couponDiscounts: 1,
        netMerchandiseSales: { $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] },
        shippingRevenue: 1,
        taxCollected: 1,
        refunds: 1,
        netSales: {
          $subtract: [{ $add: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$shippingRevenue"] }, "$refunds"]
        },
        aov: {
          $cond: [
            { $gt: ["$orders", 0] },
            { $round: [{ $divide: [{ $subtract: [{ $add: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$shippingRevenue"] }, "$refunds"] }, "$orders"] }, 0] },
            0
          ]
        }
      }
    },
    { $sort: { date: 1 } }
  ];

  // Category Breakdown Pipeline
  const categoryPipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    {
      $group: {
        _id: { $ifNull: ["$items.category", "Footwear"] },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        units: { $sum: "$items.quantity" },
        orderCount: { $addToSet: "$_id" }
      }
    },
    {
      $project: {
        category: "$_id",
        revenue: 1,
        units: 1,
        orders: { $size: "$orderCount" }
      }
    },
    { $sort: { revenue: -1 } }
  ];

  // Gender Breakdown Pipeline
  const genderPipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    {
      $group: {
        _id: { $toLower: { $ifNull: ["$items.gender", "unisex"] } },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        units: { $sum: "$items.quantity" }
      }
    },
    {
      $project: {
        gender: "$_id",
        revenue: 1,
        units: 1
      }
    },
    { $sort: { revenue: -1 } }
  ];

  // Size Breakdown Pipeline
  const sizePipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.size",
        units: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
      }
    },
    { $sort: { units: -1 } },
    { $limit: 12 }
  ];

  // Color Breakdown Pipeline
  const colorPipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    {
      $match: { "items.color": { $ne: "", $exists: true } }
    },
    {
      $group: {
        _id: "$items.color",
        units: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
      }
    },
    { $sort: { units: -1 } },
    { $limit: 10 }
  ];

  // Payment Method Breakdown Pipeline
  const paymentPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$pricing.total" }
      }
    },
    {
      $project: {
        paymentMethod: "$_id",
        count: 1,
        totalAmount: 1
      }
    },
    { $sort: { count: -1 } }
  ];

  // Geography (State) Breakdown Pipeline
  const statePipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: { $ifNull: ["$shippingAddress.state", "Unknown"] },
        orders: { $sum: 1 },
        revenue: { $sum: "$pricing.total" }
      }
    },
    {
      $project: {
        state: "$_id",
        orders: 1,
        revenue: 1
      }
    },
    { $sort: { orders: -1 } },
    { $limit: 10 }
  ];

  const [timeSeries, categories, genders, sizes, colors, paymentMethods, states] = await Promise.all([
    Order.aggregate(timeSeriesPipeline),
    Order.aggregate(categoryPipeline),
    Order.aggregate(genderPipeline),
    Order.aggregate(sizePipeline),
    Order.aggregate(colorPipeline),
    Order.aggregate(paymentPipeline),
    Order.aggregate(statePipeline)
  ]);

  return {
    dateRange: { start, end, interval },
    timeSeries,
    categories,
    genders,
    sizes,
    colors,
    paymentMethods,
    states
  };
}

/**
 * 3. Customer 360 Analytics Aggregation (Customer list with lifetime metrics and segmentation)
 */
async function getCustomerAnalytics({ page = 1, limit = 20, search = "", sortBy = "netSpend", sortDir = "desc", segment = "" } = {}) {
  const pg = Math.max(1, parseInt(page, 10));
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pg - 1) * lim;

  // Build match stage for users
  const userMatch = { role: "user" };
  if (search) {
    userMatch.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } }
    ];
  }

  const pipeline = [
    { $match: userMatch },
    // Lookup completed orders for each user
    {
      $lookup: {
        from: "orders",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$userId"] },
                  { $ne: ["$status", "cancelled"] }
                ]
              }
            }
          },
          {
            $project: {
              orderNumber: 1,
              createdAt: 1,
              pricing: 1,
              totalRefundedAmount: 1,
              items: 1,
              status: 1
            }
          }
        ],
        as: "orderHistory"
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        avatar: 1,
        createdAt: 1,
        lastLogin: 1,
        totalOrders: { $size: "$orderHistory" },
        grossSpend: {
          $reduce: {
            input: "$orderHistory",
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.pricing.subtotal", 0] }] }
          }
        },
        totalDiscounts: {
          $reduce: {
            input: "$orderHistory",
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.pricing.couponDiscount", 0] }] }
          }
        },
        totalRefunds: {
          $reduce: {
            input: "$orderHistory",
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.totalRefundedAmount", 0] }] }
          }
        },
        netSpend: {
          $reduce: {
            input: "$orderHistory",
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                {
                  $subtract: [
                    { $ifNull: ["$$this.pricing.total", 0] },
                    { $ifNull: ["$$this.totalRefundedAmount", 0] }
                  ]
                }
              ]
            }
          }
        },
        firstOrderDate: { $min: "$orderHistory.createdAt" },
        lastOrderDate: { $max: "$orderHistory.createdAt" }
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        avatar: 1,
        createdAt: 1,
        lastLogin: 1,
        totalOrders: 1,
        grossSpend: 1,
        totalDiscounts: 1,
        totalRefunds: 1,
        netSpend: { $max: [0, "$netSpend"] },
        firstOrderDate: 1,
        lastOrderDate: 1,
        aov: {
          $cond: [
            { $gt: ["$totalOrders", 0] },
            { $round: [{ $divide: ["$netSpend", "$totalOrders"] }, 0] },
            0
          ]
        },
        daysSinceLastOrder: {
          $cond: [
            { $gt: ["$totalOrders", 0] },
            { $round: [{ $divide: [{ $subtract: [new Date(), "$lastOrderDate"] }, 86400000] }, 0] },
            null
          ]
        },
        // RFM Segmentation Rule:
        // New: 1 order within 30 days
        // Active Repeat: >= 2 orders, last order <= 90 days
        // At-Risk: >= 2 orders, last order 91-180 days
        // Dormant: > 180 days or 0 orders
        segment: {
          $cond: [
            { $eq: ["$totalOrders", 0] },
            "Prospect",
            {
              $cond: [
                {
                  $and: [
                    { $eq: ["$totalOrders", 1] },
                    { $lte: [{ $divide: [{ $subtract: [new Date(), "$lastOrderDate"] }, 86400000] }, 30] }
                  ]
                },
                "New",
                {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$totalOrders", 2] },
                        { $lte: [{ $divide: [{ $subtract: [new Date(), "$lastOrderDate"] }, 86400000] }, 90] }
                      ]
                    },
                    "Active Repeat",
                    {
                      $cond: [
                        {
                          $and: [
                            { $gte: ["$totalOrders", 2] },
                            { $lte: [{ $divide: [{ $subtract: [new Date(), "$lastOrderDate"] }, 86400000] }, 180] }
                          ]
                        },
                        "At-Risk",
                        "Dormant"
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    }
  ];

  if (segment) {
    pipeline.push({ $match: { segment } });
  }

  // Sorting
  const sortStage = {};
  const sortDirection = sortDir === "asc" ? 1 : -1;
  if (sortBy === "netSpend") sortStage.netSpend = sortDirection;
  else if (sortBy === "totalOrders") sortStage.totalOrders = sortDirection;
  else if (sortBy === "aov") sortStage.aov = sortDirection;
  else if (sortBy === "lastOrderDate") sortStage.lastOrderDate = sortDirection;
  else sortStage.createdAt = -1;

  pipeline.push({ $sort: sortStage });

  // Facet for pagination and counts
  const facetPipeline = [
    ...pipeline,
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: lim }]
      }
    }
  ];

  const result = await User.aggregate(facetPipeline);
  const total = result[0]?.metadata[0]?.total || 0;
  const customers = result[0]?.data || [];

  return {
    customers,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * 4. Customer 360 Individual Profile (Frequency-based preferences + timeline)
 */
async function getCustomer360Profile(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error("Invalid customer ID"), { statusCode: 400 });
  }

  const uId = new mongoose.Types.ObjectId(userId);
  const user = await User.findById(uId).select("-password -refreshToken").lean();
  if (!user) {
    throw Object.assign(new Error("Customer not found"), { statusCode: 404 });
  }

  // Fetch all orders chronologically
  const orders = await Order.find({ user: uId })
    .sort({ createdAt: -1 })
    .populate("items.product", "name images slug")
    .lean();

  const nonCancelledOrders = orders.filter(o => o.status !== "cancelled");

  // Deterministic Frequency Calculations
  const categoryFreq = {};
  const sizeFreq = {};
  const colorFreq = {};
  const cityFreq = {};
  const stateFreq = {};

  let latestCategory = "";
  let latestSize = "";
  let latestColor = "";
  let latestCity = "";
  let latestState = "";

  let totalGrossSpend = 0;
  let totalDiscounts = 0;
  let totalRefunds = 0;
  let totalNetSpend = 0;
  let totalUnits = 0;

  for (let i = 0; i < nonCancelledOrders.length; i++) {
    const o = nonCancelledOrders[i];
    totalGrossSpend += (o.pricing?.subtotal || 0);
    totalDiscounts += (o.pricing?.couponDiscount || 0);
    totalRefunds += (o.totalRefundedAmount || 0);
    totalNetSpend += Math.max(0, (o.pricing?.total || 0) - (o.totalRefundedAmount || 0));

    if (o.shippingAddress?.city) {
      const city = o.shippingAddress.city.trim();
      cityFreq[city] = (cityFreq[city] || 0) + 1;
      if (!latestCity) latestCity = city;
    }

    if (o.shippingAddress?.state) {
      const st = o.shippingAddress.state.trim();
      stateFreq[st] = (stateFreq[st] || 0) + 1;
      if (!latestState) latestState = st;
    }

    for (const item of o.items || []) {
      const qty = item.quantity || 1;
      totalUnits += qty;

      const cat = item.category || "Footwear";
      categoryFreq[cat] = (categoryFreq[cat] || 0) + qty;
      if (!latestCategory) latestCategory = cat;

      if (item.size) {
        const sz = String(item.size).trim();
        sizeFreq[sz] = (sizeFreq[sz] || 0) + qty;
        if (!latestSize) latestSize = sz;
      }

      if (item.color) {
        const cl = String(item.color).trim();
        colorFreq[cl] = (colorFreq[cl] || 0) + qty;
        if (!latestColor) latestColor = cl;
      }
    }
  }

  // Helper for mode with fallback
  const getMode = (freqObj, fallback) => {
    let maxKey = fallback;
    let maxCount = 0;
    for (const [k, v] of Object.entries(freqObj)) {
      if (v > maxCount) {
        maxCount = v;
        maxKey = k;
      }
    }
    return maxKey || "N/A";
  };

  const preferredCategory = getMode(categoryFreq, latestCategory);
  const preferredSize = getMode(sizeFreq, latestSize);
  const preferredColor = getMode(colorFreq, latestColor);
  const preferredCity = getMode(cityFreq, latestCity);
  const preferredState = getMode(stateFreq, latestState);

  const completedCount = nonCancelledOrders.length;
  const aov = completedCount > 0 ? Math.round(totalNetSpend / completedCount) : 0;

  return {
    customer: {
      ...user,
      totalOrders: completedCount,
      totalUnits,
      grossSpend: totalGrossSpend,
      totalDiscounts,
      totalRefunds,
      netSpend: totalNetSpend,
      aov,
      firstOrderDate: nonCancelledOrders[nonCancelledOrders.length - 1]?.createdAt || null,
      lastOrderDate: nonCancelledOrders[0]?.createdAt || null
    },
    preferences: {
      preferredCategory,
      preferredSize,
      preferredColor,
      preferredCity,
      preferredState,
      categoryDistribution: categoryFreq,
      sizeDistribution: sizeFreq,
      colorDistribution: colorFreq
    },
    orderHistory: orders
  };
}

/**
 * 5. Data Quality Monitoring Engine
 */
async function getDataQualityMetrics() {
  const [
    totalOrders,
    missingCustomerCount,
    missingHsnCount,
    cogsMetrics,
    missingTaxSnapshotCount,
    missingSettlementCount,
    unreconciledRefundsCount
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ user: { $exists: false } }),
    Order.countDocuments({ "items.hsn": { $in: ["", null, undefined] } }),
    Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.costPriceSource",
          count: { $sum: 1 }
        }
      }
    ]),
    Order.countDocuments({ "items.taxRate": { $in: [0, null, undefined] } }),
    Order.countDocuments({ paymentMethod: { $ne: "cod" }, "gatewaySettlement.fee": null }),
    Order.countDocuments({ isRefunded: true, "refunds.0": { $exists: false } })
  ]);

  if (totalOrders === 0) {
    return {
      overallReadinessScore: 0,
      totalOrders: 0,
      totalLineItems: 0,
      isInitialized: true,
      status: "initialized_empty",
      message: "Database initialized — awaiting first order transactions to populate data quality telemetry.",
      indicators: {
        cogs: {
          totalItems: 0,
          actualCount: 0,
          estimatedCount: 0,
          unknownCount: 0,
          completenessPercent: 0,
          status: "info",
          message: "No order records exist yet."
        },
        hsn: {
          missingCount: 0,
          status: "info",
          message: "No order records exist yet."
        },
        taxSnapshot: {
          missingCount: 0,
          status: "info",
          message: "No order records exist yet."
        },
        customerLinkage: {
          missingCount: 0,
          status: "info",
          message: "No order records exist yet."
        },
        gatewaySettlement: {
          unreconciledCount: 0,
          status: "info",
          message: "No order records exist yet."
        },
        refundIntegrity: {
          unlinkedCount: 0,
          status: "info",
          message: "No order records exist yet."
        }
      }
    };
  }

  // Check product catalog data quality issues
  const [
    productsMissingSku,
    productsMissingHsn,
    productsMissingCost,
    productsInvalidStock,
    ordersMissingWaybill
  ] = await Promise.all([
    Product.countDocuments({ $or: [{ sku: "" }, { sku: null }, { sku: { $exists: false } }] }),
    Product.countDocuments({ $or: [{ hsn: "" }, { hsn: null }, { hsn: { $exists: false } }] }),
    Product.countDocuments({ $or: [{ costPrice: null }, { costPrice: { $exists: false } }] }),
    Product.countDocuments({ totalStock: { $lt: 0 } }),
    Order.countDocuments({ status: { $in: ["processing", "shipped", "delivered"] }, "shipping.waybill": { $in: ["", null, undefined] } })
  ]);

  let actualCogsItems = 0;
  let estimatedCogsItems = 0;
  let unknownCogsItems = 0;
  let totalLineItems = 0;

  for (const row of cogsMetrics) {
    const cnt = row.count || 0;
    totalLineItems += cnt;
    if (row._id === "actual") actualCogsItems += cnt;
    else if (row._id === "estimated") estimatedCogsItems += cnt;
    else unknownCogsItems += cnt;
  }

  const cogsCompletenessPercent = totalLineItems > 0
    ? Math.round(((actualCogsItems + estimatedCogsItems) / totalLineItems) * 100)
    : 0;

  // Calculate overall data readiness score (0-100)
  let score = 100;
  if (unknownCogsItems > 0) score -= 20;
  if (missingHsnCount > 0 || productsMissingHsn > 0) score -= 15;
  if (missingTaxSnapshotCount > 0) score -= 15;
  if (missingCustomerCount > 0) score -= 15;
  if (unreconciledRefundsCount > 0) score -= 10;
  if (productsMissingSku > 0) score -= 10;
  if (ordersMissingWaybill > 0) score -= 10;
  score = Math.max(10, Math.min(100, score));

  return {
    overallReadinessScore: score,
    totalOrders,
    totalLineItems,
    indicators: {
      cogs: {
        totalItems: totalLineItems,
        actualCount: actualCogsItems,
        estimatedCount: estimatedCogsItems,
        unknownCount: unknownCogsItems,
        completenessPercent: cogsCompletenessPercent,
        status: unknownCogsItems === 0 ? "healthy" : "warning",
        message: unknownCogsItems === 0
          ? "All order items have verified or estimated cost bases."
          : `${unknownCogsItems} order items are missing COGS data. Profit calculations reflect incomplete cost baseline.`
      },
      hsn: {
        missingCount: missingHsnCount,
        productsMissingHsn,
        status: missingHsnCount === 0 && productsMissingHsn === 0 ? "healthy" : "action_required",
        message: missingHsnCount === 0 && productsMissingHsn === 0
          ? "All products and order items carry registered HSN classifications."
          : `${missingHsnCount} order items and ${productsMissingHsn} products lack verified HSN codes.`
      },
      sku: {
        missingCount: productsMissingSku,
        status: productsMissingSku === 0 ? "healthy" : "warning",
        message: productsMissingSku === 0
          ? "All catalog products have unique SKU barcodes."
          : `${productsMissingSku} products lack defined SKU codes.`
      },
      taxSnapshot: {
        missingCount: missingTaxSnapshotCount,
        status: missingTaxSnapshotCount === 0 ? "healthy" : "warning",
        message: missingTaxSnapshotCount === 0
          ? "All order items possess immutable GST rate snapshots."
          : `${missingTaxSnapshotCount} historical orders lack detailed tax snapshots.`
      },
      customerLinkage: {
        missingCount: missingCustomerCount,
        status: missingCustomerCount === 0 ? "healthy" : "warning",
        message: missingCustomerCount === 0
          ? "All orders are linked to registered user accounts."
          : `${missingCustomerCount} orders lack valid customer accounts.`
      },
      shippingWaybill: {
        missingCount: ordersMissingWaybill,
        status: ordersMissingWaybill === 0 ? "healthy" : "warning",
        message: ordersMissingWaybill === 0
          ? "All dispatched orders have recorded Delhivery AWB waybills."
          : `${ordersMissingWaybill} dispatched orders lack courier waybill tracking records.`
      },
      gatewaySettlement: {
        unreconciledCount: missingSettlementCount,
        status: "info",
        message: `${missingSettlementCount} online payments currently use estimated transaction fee rates. Actual settlement reconciliation planned for Phase 3.`
      },
      refundIntegrity: {
        unlinkedCount: unreconciledRefundsCount,
        status: unreconciledRefundsCount === 0 ? "healthy" : "warning",
        message: unreconciledRefundsCount === 0
          ? "All recorded refunds have structured transaction records."
          : `${unreconciledRefundsCount} legacy refunds are recorded as flat booleans without granular transaction objects.`
      }
    }
  };
}

/**
 * 6. Product Analytics Pipeline (Detailed Product-level performance)
 *
 * Reconciled with Phase 1 Financial Definitions:
 * - Gross Merchandise Sales (GMS) = sum(items.price * items.quantity) [Catalog selling price before order-level coupons]
 * - Product Discounts = sum(items.itemDiscount * items.quantity) [Catalog/markdown discount from MRP]
 * - Coupon Discounts = sum(items.allocatedCouponDiscount) [Pro-rata allocated coupon discount]
 * - Net Merchandise Sales = GMS - Coupon Discounts
 * - Refund Value = sum(refunded items price * quantity) [Line-item refund value]
 * - Net Sales = Net Merchandise Sales - Refund Value
 * - Shipping Revenue & Taxes: Excluded from item-level net product sales (tracked at order-level)
 * - Gross Profit = Net Sales - Total COGS (Computed ONLY when cogsCountUnknown === 0)
 * - Gross Margin (%) = (Gross Profit / Net Sales) * 100
 * - Unit Return Rate (%) = (refundQuantity / unitsSold) * 100
 * - Low-stock threshold is configurable via parameter `lowStockThreshold` (default = 5)
 */
async function getProductAnalytics({ startDate, endDate, category, gender, search, sortBy = "grossMerchandiseSales", sortDir = "desc", page = 1, limit = 20, lowStockThreshold = 5 } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);
  const pg = Math.max(1, parseInt(page, 10));
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pg - 1) * lim;
  const threshold = Math.max(1, parseInt(lowStockThreshold, 10) || 5);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const itemMatch = {};
  if (category) itemMatch["items.category"] = category;
  if (gender) itemMatch["items.gender"] = gender.toLowerCase();
  if (search) {
    itemMatch.$or = [
      { "items.name": { $regex: search, $options: "i" } },
      { "items.sku": { $regex: search, $options: "i" } }
    ];
  }

  const pipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
    {
      $group: {
        _id: "$items.product",
        productName: { $first: "$items.name" },
        image: { $first: "$items.image" },
        sku: { $first: { $ifNull: ["$items.sku", ""] } },
        category: { $first: { $ifNull: ["$items.category", "Footwear"] } },
        gender: { $first: { $ifNull: ["$items.gender", "unisex"] } },
        unitsSold: { $sum: "$items.quantity" },
        grossMerchandiseSales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        productDiscounts: { $sum: { $multiply: [{ $ifNull: ["$items.itemDiscount", 0] }, "$items.quantity"] } },
        couponDiscounts: { $sum: { $ifNull: ["$items.allocatedCouponDiscount", 0] } },
        refundQuantity: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, "$items.quantity", 0] }
        },
        refundValue: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, { $multiply: ["$items.price", "$items.quantity"] }, 0] }
        },
        totalCogs: {
          $sum: { $cond: [{ $ne: ["$items.costPrice", null] }, { $multiply: ["$items.costPrice", "$items.quantity"] }, 0] }
        },
        cogsCountActual: { $sum: { $cond: [{ $eq: ["$items.costPriceSource", "actual"] }, 1, 0] } },
        cogsCountEstimated: { $sum: { $cond: [{ $eq: ["$items.costPriceSource", "estimated"] }, 1, 0] } },
        cogsCountUnknown: { $sum: { $cond: [{ $or: [{ $eq: ["$items.costPriceSource", "unknown"] }, { $eq: ["$items.costPrice", null] }] }, 1, 0] } },
        ordersCount: { $addToSet: "$_id" }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "liveProduct"
      }
    },
    {
      $project: {
        _id: 1,
        productName: 1,
        image: 1,
        sku: 1,
        category: 1,
        gender: 1,
        unitsSold: 1,
        ordersCount: { $size: "$ordersCount" },
        grossMerchandiseSales: 1,
        productDiscounts: 1,
        couponDiscounts: 1,
        netMerchandiseSales: { $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] },
        refundQuantity: 1,
        refundValue: 1,
        netSales: { $subtract: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$refundValue"] },
        asp: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $divide: ["$grossMerchandiseSales", "$unitsSold"] }, 0] },
            0
          ]
        },
        unitReturnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$refundQuantity", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        },
        returnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$refundQuantity", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        },
        currentStock: { $ifNull: [{ $arrayElemAt: ["$liveProduct.totalStock", 0] }, 0] },
        stockRetailValue: {
          $multiply: [
            { $ifNull: [{ $arrayElemAt: ["$liveProduct.totalStock", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$liveProduct.price", 0] }, 0] }
          ]
        },
        isActive: { $ifNull: [{ $arrayElemAt: ["$liveProduct.isActive", 0] }, false] },
        cogsStatus: {
          $cond: [
            { $gt: ["$cogsCountUnknown", 0] },
            "incomplete",
            {
              $cond: [
                { $gt: ["$cogsCountEstimated", 0] },
                "estimated",
                "actual"
              ]
            }
          ]
        },
        grossProfit: {
          $cond: [
            { $eq: ["$cogsCountUnknown", 0] },
            { $subtract: [{ $subtract: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$refundValue"] }, "$totalCogs"] },
            null
          ]
        },
        grossMargin: {
          $cond: [
            {
              $and: [
                { $eq: ["$cogsCountUnknown", 0] },
                { $gt: [{ $subtract: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$refundValue"] }, 0] }
              ]
            },
            {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: [{ $subtract: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$refundValue"] }, "$totalCogs"] },
                        { $subtract: [{ $subtract: ["$grossMerchandiseSales", "$couponDiscounts"] }, "$refundValue"] }
                      ]
                    },
                    100
                  ]
                },
                1
              ]
            },
            null
          ]
        }
      }
    },
    {
      $project: {
        _id: 1,
        productName: 1,
        image: 1,
        sku: 1,
        category: 1,
        gender: 1,
        unitsSold: 1,
        ordersCount: 1,
        grossMerchandiseSales: 1,
        productDiscounts: 1,
        couponDiscounts: 1,
        netMerchandiseSales: 1,
        refundQuantity: 1,
        refundValue: 1,
        netSales: 1,
        asp: 1,
        unitReturnRate: 1,
        returnRate: 1,
        currentStock: 1,
        stockRetailValue: 1,
        isActive: 1,
        cogsStatus: 1,
        grossProfit: 1,
        grossMargin: 1,
        sellThroughRate: {
          $cond: [
            { $gt: [{ $add: ["$unitsSold", "$currentStock"] }, 0] },
            { $round: [{ $multiply: [{ $divide: ["$unitsSold", { $add: ["$unitsSold", "$currentStock"] }] }, 100] }, 1] },
            0
          ]
        },
        healthTag: {
          $cond: [
            { $eq: ["$currentStock", 0] },
            "Out of Stock",
            {
              $cond: [
                { $lte: ["$currentStock", threshold] },
                "Low Stock",
                {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$returnRate", 15] },
                        { $gte: ["$refundQuantity", 2] }
                      ]
                    },
                    "High Return Rate",
                    {
                      $cond: [
                        { $gte: ["$unitsSold", 10] },
                        "High Demand",
                        {
                          $cond: [
                            { $eq: ["$unitsSold", 0] },
                            "Slow Moving",
                            "In Stock"
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    }
  ];

  const sortStage = {};
  const sortDirection = sortDir === "asc" ? 1 : -1;
  sortStage[sortBy] = sortDirection;
  pipeline.push({ $sort: sortStage });

  const facetPipeline = [
    ...pipeline,
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: lim }]
      }
    }
  ];

  const result = await Order.aggregate(facetPipeline);
  const total = result[0]?.metadata[0]?.total || 0;
  const products = result[0]?.data || [];

  return {
    dateRange: { start, end },
    products,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * 7. Size & Color Analytics Pipeline
 */
async function getSizeColorAnalytics({ startDate, endDate, category, gender, productId } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const itemMatch = {};
  if (category) itemMatch["items.category"] = category;
  if (gender) itemMatch["items.gender"] = gender.toLowerCase();
  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    itemMatch["items.product"] = new mongoose.Types.ObjectId(productId);
  }

  const sizePipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
    {
      $group: {
        _id: "$items.size",
        unitsSold: { $sum: "$items.quantity" },
        grossSales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        couponDiscounts: { $sum: { $ifNull: ["$items.allocatedCouponDiscount", 0] } },
        refundQuantity: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, "$items.quantity", 0] }
        },
        refundValue: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, { $multiply: ["$items.price", "$items.quantity"] }, 0] }
        },
        ordersCount: { $addToSet: "$_id" }
      }
    },
    {
      $project: {
        size: "$_id",
        unitsSold: 1,
        grossSales: 1,
        couponDiscounts: 1,
        netSales: { $subtract: [{ $subtract: ["$grossSales", "$couponDiscounts"] }, "$refundValue"] },
        refundQuantity: 1,
        refundValue: 1,
        orders: { $size: "$ordersCount" },
        unitReturnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$refundQuantity", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        },
        returnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$refundQuantity", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        }
      }
    },
    { $sort: { unitsSold: -1 } }
  ];

  const colorPipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    { $match: { "items.color": { $ne: "", $exists: true }, ...itemMatch } },
    {
      $group: {
        _id: "$items.color",
        unitsSold: { $sum: "$items.quantity" },
        grossSales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        couponDiscounts: { $sum: { $ifNull: ["$items.allocatedCouponDiscount", 0] } },
        refundQuantity: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, "$items.quantity", 0] }
        },
        refundValue: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, { $multiply: ["$items.price", "$items.quantity"] }, 0] }
        },
        ordersCount: { $addToSet: "$_id" }
      }
    },
    {
      $project: {
        color: "$_id",
        unitsSold: 1,
        grossSales: 1,
        couponDiscounts: 1,
        netSales: { $subtract: [{ $subtract: ["$grossSales", "$couponDiscounts"] }, "$refundValue"] },
        refundQuantity: 1,
        refundValue: 1,
        orders: { $size: "$ordersCount" },
        unitReturnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$refundQuantity", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        },
        returnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$refundQuantity", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        }
      }
    },
    { $sort: { unitsSold: -1 } }
  ];

  const productSizePipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
    {
      $group: {
        _id: { product: "$items.name", size: "$items.size" },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
      }
    },
    {
      $project: {
        product: "$_id.product",
        size: "$_id.size",
        unitsSold: 1,
        revenue: 1
      }
    },
    { $sort: { unitsSold: -1 } },
    { $limit: 15 }
  ];

  const [sizes, colors, productSizes] = await Promise.all([
    Order.aggregate(sizePipeline),
    Order.aggregate(colorPipeline),
    Order.aggregate(productSizePipeline)
  ]);

  return {
    dateRange: { start, end },
    sizes,
    colors,
    productSizes
  };
}

/**
 * 8. Inventory Analytics Pipeline (Current catalog stock telemetry)
 *
 * Valuation Breakdown:
 * - Known Cost Value: totalStock * costPrice where costPriceSource = "actual"
 * - Estimated Cost Value: totalStock * costPrice where costPriceSource = "estimated"
 * - Unknown Cost Units: totalStock where costPrice = null or costPriceSource = "unknown" (never treated as ₹0 cost)
 * - Low-stock threshold is configurable via parameter `lowStockThreshold` (default = 5)
 */
async function getInventoryAnalytics({ lowStockThreshold = 5 } = {}) {
  const threshold = Math.max(1, parseInt(lowStockThreshold, 10) || 5);

  const [
    totalProducts,
    activeProducts,
    stockAgg,
    categoryStock,
    genderStock,
    lowStockList,
    outOfStockList
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalUnits: { $sum: "$totalStock" },
          totalRetailValue: { $sum: { $multiply: ["$totalStock", "$price"] } },
          knownCostValue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$costPrice", null] }, { $eq: ["$costPriceSource", "actual"] }] },
                { $multiply: ["$totalStock", "$costPrice"] },
                0
              ]
            }
          },
          estimatedCostValue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$costPrice", null] }, { $eq: ["$costPriceSource", "estimated"] }] },
                { $multiply: ["$totalStock", "$costPrice"] },
                0
              ]
            }
          },
          knownCostUnits: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$costPrice", null] }, { $eq: ["$costPriceSource", "actual"] }] },
                "$totalStock",
                0
              ]
            }
          },
          estimatedCostUnits: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$costPrice", null] }, { $eq: ["$costPriceSource", "estimated"] }] },
                "$totalStock",
                0
              ]
            }
          },
          unknownCostUnits: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$costPrice", null] }, { $eq: ["$costPriceSource", "unknown"] }] },
                "$totalStock",
                0
              ]
            }
          },
          unknownCostStyles: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$costPrice", null] }, { $eq: ["$costPriceSource", "unknown"] }] },
                1,
                0
              ]
            }
          },
          lowStockCount: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$totalStock", 0] }, { $lte: ["$totalStock", threshold] }] },
                1,
                0
              ]
            }
          },
          outOfStockCount: {
            $sum: { $cond: [{ $eq: ["$totalStock", 0] }, 1, 0] }
          }
        }
      }
    ]),
    Product.aggregate([
      { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "cat" } },
      {
        $group: {
          _id: { $ifNull: [{ $arrayElemAt: ["$cat.name", 0] }, "Uncategorized"] },
          unitsInStock: { $sum: "$totalStock" },
          productCount: { $sum: 1 },
          stockRetailValue: { $sum: { $multiply: ["$totalStock", "$price"] } }
        }
      },
      { $project: { category: "$_id", unitsInStock: 1, productCount: 1, stockRetailValue: 1 } },
      { $sort: { unitsInStock: -1 } }
    ]),
    Product.aggregate([
      {
        $group: {
          _id: "$gender",
          unitsInStock: { $sum: "$totalStock" },
          productCount: { $sum: 1 }
        }
      },
      { $project: { gender: "$_id", unitsInStock: 1, productCount: 1 } },
      { $sort: { unitsInStock: -1 } }
    ]),
    Product.find({ totalStock: { $gt: 0, $lte: threshold } })
      .select("name totalStock sizes price images")
      .limit(10)
      .lean(),
    Product.find({ totalStock: 0 })
      .select("name totalStock sizes price images")
      .limit(10)
      .lean()
  ]);

  const summary = stockAgg[0] || {
    totalUnits: 0,
    totalRetailValue: 0,
    knownCostValue: 0,
    estimatedCostValue: 0,
    knownCostUnits: 0,
    estimatedCostUnits: 0,
    unknownCostUnits: 0,
    unknownCostStyles: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  };

  const totalCostValue = summary.knownCostValue + summary.estimatedCostValue;
  const costCoveragePercent = summary.totalUnits > 0
    ? Math.round(((summary.knownCostUnits + summary.estimatedCostUnits) / summary.totalUnits) * 100)
    : 0;

  return {
    kpis: {
      totalProducts,
      activeProducts,
      totalUnitsInStock: summary.totalUnits,
      lowStockThreshold: threshold,
      lowStockProducts: summary.lowStockCount,
      outOfStockProducts: summary.outOfStockCount,
      stockRetailValue: summary.totalRetailValue,
      stockCostValue: totalCostValue,
      knownCostValue: summary.knownCostValue,
      estimatedCostValue: summary.estimatedCostValue,
      unknownCostUnits: summary.unknownCostUnits,
      unknownCostStyles: summary.unknownCostStyles,
      costCoveragePercent
    },
    categoryStock,
    genderStock,
    lowStockList,
    outOfStockList,
    disclosures: {
      isHistoricalStockMovementAvailable: false,
      message: "Current inventory reflects real-time stock levels. Historical day-by-day stock movement ledger requires an ERP inventory inwarding system (Phase 3)."
    }
  };
}

/**
 * 9. Geography Analytics Pipeline (State & City customer orders)
 */
async function getGeographyAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const statePipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: { $ifNull: ["$shippingAddress.state", "Unknown"] },
        orders: { $sum: 1 },
        grossRevenue: { $sum: "$pricing.total" },
        refunds: { $sum: { $ifNull: ["$totalRefundedAmount", 0] } },
        unitsSold: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.quantity"] }
            }
          }
        },
        customers: { $addToSet: "$user" }
      }
    },
    {
      $project: {
        state: "$_id",
        orders: 1,
        grossRevenue: 1,
        netSales: { $subtract: ["$grossRevenue", "$refunds"] },
        unitsSold: 1,
        uniqueCustomers: { $size: "$customers" }
      }
    },
    { $sort: { orders: -1 } }
  ];

  const cityPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: {
          city: { $ifNull: ["$shippingAddress.city", "Unknown"] },
          state: { $ifNull: ["$shippingAddress.state", "Unknown"] }
        },
        orders: { $sum: 1 },
        revenue: { $sum: "$pricing.total" },
        unitsSold: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.quantity"] }
            }
          }
        }
      }
    },
    {
      $project: {
        city: "$_id.city",
        state: "$_id.state",
        orders: 1,
        revenue: 1,
        unitsSold: 1
      }
    },
    { $sort: { orders: -1 } },
    { $limit: 20 }
  ];

  const pincodePipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: "$shippingAddress.zipCode",
        orders: { $sum: 1 },
        revenue: { $sum: "$pricing.total" }
      }
    },
    { $project: { pincode: "$_id", orders: 1, revenue: 1 } },
    { $sort: { orders: -1 } },
    { $limit: 10 }
  ];

  const [states, cities, pincodes] = await Promise.all([
    Order.aggregate(statePipeline),
    Order.aggregate(cityPipeline),
    Order.aggregate(pincodePipeline)
  ]);

  return {
    dateRange: { start, end },
    states,
    cities,
    pincodes
  };
}

/**
 * 10. Payment Analytics Pipeline (Methods, Paid vs Unpaid, Refunds)
 */
async function getPaymentAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end }
  };

  const paymentMethodsPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: "$paymentMethod",
        totalOrders: { $sum: 1 },
        completedOrders: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, 1, 0] } },
        paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
        unpaidOrders: { $sum: { $cond: ["$isPaid", 0, 1] } },
        grossRevenue: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$pricing.total", 0] } },
        refundedAmount: { $sum: { $ifNull: ["$totalRefundedAmount", 0] } }
      }
    },
    {
      $project: {
        paymentMethod: "$_id",
        totalOrders: 1,
        completedOrders: 1,
        paidOrders: 1,
        unpaidOrders: 1,
        grossRevenue: 1,
        refundedAmount: 1,
        netRevenue: { $subtract: ["$grossRevenue", "$refundedAmount"] }
      }
    },
    { $sort: { totalOrders: -1 } }
  ];

  const summaryPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        codOrders: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cod"] }, 1, 0] } },
        prepaidOrders: { $sum: { $cond: [{ $ne: ["$paymentMethod", "cod"] }, 1, 0] } },
        paidRevenue: { $sum: { $cond: ["$isPaid", "$pricing.total", 0] } },
        unpaidRevenue: { $sum: { $cond: ["$isPaid", 0, "$pricing.total"] } },
        totalRefunds: { $sum: { $ifNull: ["$totalRefundedAmount", 0] } }
      }
    }
  ];

  const [methods, summaryAgg] = await Promise.all([
    Order.aggregate(paymentMethodsPipeline),
    Order.aggregate(summaryPipeline)
  ]);

  const summary = summaryAgg[0] || {
    totalOrders: 0,
    codOrders: 0,
    prepaidOrders: 0,
    paidRevenue: 0,
    unpaidRevenue: 0,
    totalRefunds: 0
  };

  return {
    dateRange: { start, end },
    summary: {
      ...summary,
      prepaidSharePercent: summary.totalOrders > 0
        ? Math.round((summary.prepaidOrders / summary.totalOrders) * 100)
        : 0
    },
    methods,
    settlementDisclaimer: {
      status: "unreconciled",
      message: "Gateway processing fee deduction and actual net bank settlement ingestion are planned for Phase 3 reconciliation."
    }
  };
}

/**
 * 11. Shipping / Delhivery Logistics Analytics Pipeline
 */
async function getShippingAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end }
  };

  const shippingMetricsPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        manifested: {
          $sum: {
            $cond: [
              { $in: ["$shipping.delhiveryStatus", ["Manifested", "MAN", "Order Created"]] },
              1,
              0
            ]
          }
        },
        inTransit: {
          $sum: {
            $cond: [
              { $in: ["$shipping.delhiveryStatus", ["In Transit", "IT", "DIS", "HUB", "Picked Up", "PU"]] },
              1,
              0
            ]
          }
        },
        outForDelivery: {
          $sum: {
            $cond: [
              { $in: ["$shipping.delhiveryStatus", ["Out for Delivery", "OFD", "RAD"]] },
              1,
              0
            ]
          }
        },
        delivered: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ["$status", "delivered"] }, { $in: ["$shipping.delhiveryStatus", ["Delivered", "DL"]] }] },
              1,
              0
            ]
          }
        },
        rto: {
          $sum: {
            $cond: [
              { $in: ["$shipping.delhiveryStatus", ["RTO", "RT", "DTO", "RTO-In Transit", "RTO-Delivered", "NDR"]] },
              1,
              0
            ]
          }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
        },
        customerShippingCollected: { $sum: { $ifNull: ["$pricing.shippingCost", 0] } }
      }
    }
  ];

  const courierStatusPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: { $ifNull: ["$shipping.delhiveryStatus", "Pending Manifest"] },
        count: { $sum: 1 }
      }
    },
    { $project: { status: "$_id", count: 1 } },
    { $sort: { count: -1 } }
  ];

  const stateShippingPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: { $ifNull: ["$shippingAddress.state", "Unknown"] },
        totalShipments: { $sum: 1 },
        deliveredCount: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
        },
        rtoCount: {
          $sum: {
            $cond: [
              { $in: ["$shipping.delhiveryStatus", ["RTO", "RT", "DTO", "RTO-In Transit", "RTO-Delivered"]] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        state: "$_id",
        totalShipments: 1,
        deliveredCount: 1,
        rtoCount: 1,
        deliverySuccessRate: {
          $cond: [
            { $gt: ["$totalShipments", 0] },
            { $round: [{ $multiply: [{ $divide: ["$deliveredCount", "$totalShipments"] }, 100] }, 1] },
            0
          ]
        }
      }
    },
    { $sort: { totalShipments: -1 } },
    { $limit: 10 }
  ];

  const [metricsAgg, courierStatuses, stateShipping] = await Promise.all([
    Order.aggregate(shippingMetricsPipeline),
    Order.aggregate(courierStatusPipeline),
    Order.aggregate(stateShippingPipeline)
  ]);

  const metrics = metricsAgg[0] || {
    totalOrders: 0,
    manifested: 0,
    inTransit: 0,
    outForDelivery: 0,
    delivered: 0,
    rto: 0,
    cancelled: 0,
    customerShippingCollected: 0
  };

  const dispatchedCount = metrics.inTransit + metrics.outForDelivery + metrics.delivered + metrics.rto;
  const deliverySuccessRate = (metrics.delivered + metrics.rto) > 0
    ? Math.round((metrics.delivered / (metrics.delivered + metrics.rto)) * 1000) / 10
    : 100;
  const rtoRate = dispatchedCount > 0
    ? Math.round((metrics.rto / dispatchedCount) * 1000) / 10
    : 0;

  return {
    dateRange: { start, end },
    kpis: {
      ...metrics,
      dispatchedCount,
      deliverySuccessRate,
      rtoRate
    },
    courierStatuses,
    stateShipping,
    freightDisclaimer: {
      status: "unreconciled",
      message: "Customer shipping charge represents revenue collected. Actual Delhivery invoice freight cost reconciliation is a Phase 3 accounting feature."
    }
  };
}

/**
 * 12. Returns & Refunds Analytics Pipeline
 */
async function getReturnsAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end }
  };

  const returnsSummaryPipeline = [
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        deliveredOrders: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", "delivered"] },
                  { $in: ["$shipping.delhiveryStatus", ["Delivered", "DL"]] },
                  { $eq: ["$shipping.status", "delivered"] },
                  { $ifNull: ["$returnRequest.requestedAt", false] },
                  { $in: ["$status", ["returned", "refunded"]] }
                ]
              },
              1,
              0
            ]
          }
        },
        returnRequestsCount: {
          $sum: { $cond: [{ $ifNull: ["$returnRequest.requestedAt", false] }, 1, 0] }
        },
        approvedReturnsCount: {
          $sum: { $cond: [{ $eq: ["$returnRequest.status", "approved"] }, 1, 0] }
        },
        rejectedReturnsCount: {
          $sum: { $cond: [{ $eq: ["$returnRequest.status", "rejected"] }, 1, 0] }
        },
        refundedOrdersCount: {
          $sum: { $cond: ["$isRefunded", 1, 0] }
        },
        totalRefundedValue: {
          $sum: { $ifNull: ["$totalRefundedAmount", 0] }
        },
        cancellationsCount: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
        }
      }
    }
  ];

  const returnReasonsPipeline = [
    {
      $match: {
        ...matchFilter,
        "returnRequest.reason": { $exists: true, $ne: "" }
      }
    },
    {
      $group: {
        _id: "$returnRequest.reason",
        count: { $sum: 1 }
      }
    },
    { $project: { reason: "$_id", count: 1 } },
    { $sort: { count: -1 } }
  ];

  const categoryReturnsPipeline = [
    { $match: matchFilter },
    { $unwind: "$items" },
    {
      $group: {
        _id: { $ifNull: ["$items.category", "Footwear"] },
        unitsSold: { $sum: "$items.quantity" },
        returnedUnits: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, "$items.quantity", 0] }
        },
        refundValue: {
          $sum: { $cond: [{ $in: ["$status", ["returned", "refunded"]] }, { $multiply: ["$items.price", "$items.quantity"] }, 0] }
        }
      }
    },
    {
      $project: {
        category: "$_id",
        unitsSold: 1,
        returnedUnits: 1,
        refundValue: 1,
        unitReturnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$returnedUnits", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        },
        returnRate: {
          $cond: [
            { $gt: ["$unitsSold", 0] },
            { $round: [{ $multiply: [{ $divide: ["$returnedUnits", "$unitsSold"] }, 100] }, 1] },
            0
          ]
        }
      }
    },
    { $sort: { unitReturnRate: -1 } }
  ];

  const [summaryAgg, returnReasons, categoryReturns] = await Promise.all([
    Order.aggregate(returnsSummaryPipeline),
    Order.aggregate(returnReasonsPipeline),
    Order.aggregate(categoryReturnsPipeline)
  ]);

  const summary = summaryAgg[0] || {
    totalOrders: 0,
    deliveredOrders: 0,
    returnRequestsCount: 0,
    approvedReturnsCount: 0,
    rejectedReturnsCount: 0,
    refundedOrdersCount: 0,
    totalRefundedValue: 0,
    cancellationsCount: 0
  };

  // Order Return Rate = (Approved Returns / Delivered Orders) * 100
  const orderReturnRate = summary.deliveredOrders > 0
    ? Math.round((summary.approvedReturnsCount / summary.deliveredOrders) * 1000) / 10
    : 0;

  return {
    dateRange: { start, end },
    summary: {
      ...summary,
      orderReturnRate,
      overallReturnRate: orderReturnRate
    },
    returnReasons,
    categoryReturns
  };
}

module.exports = {
  getOverviewAnalytics,
  getSalesAnalytics,
  getCustomerAnalytics,
  getCustomer360Profile,
  getDataQualityMetrics,
  getProductAnalytics,
  getSizeColorAnalytics,
  getInventoryAnalytics,
  getGeographyAnalytics,
  getPaymentAnalytics,
  getShippingAnalytics,
  getReturnsAnalytics
};
