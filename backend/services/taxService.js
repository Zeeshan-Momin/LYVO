const mongoose = require("mongoose");
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const TaxRule = require("../models/TaxRule");

/**
 * Normalizes start and end dates with standard 30-day default and 00:00:00 - 23:59:59 boundaries.
 */
function parseTaxDateRange(startDate, endDate) {
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

/**
 * Safe 2-decimal rounding
 */
function round2(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

/**
 * 1. GET TAX OVERVIEW
 * Output tax, taxable sales base, rate/state/hsn breakdowns, and refund attribution.
 */
async function getTaxOverview({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const overviewPipeline = [
    { $match: matchFilter },
    {
      $project: {
        createdAt: 1,
        totalPrice: { $ifNull: ["$pricing.total", { $ifNull: ["$totalPrice", 0] }] },
        taxCollected: { $ifNull: ["$financialSnapshot.taxCollected", { $ifNull: ["$pricing.tax", 0] }] },
        placeOfSupply: { $ifNull: ["$financialSnapshot.placeOfSupply", "$shippingAddress.state"] },
        isInterState: { $ifNull: ["$financialSnapshot.isInterState", false] },
        items: 1,
        refunds: 1
      }
    },
    {
      $facet: {
        orderSummary: [
          {
            $group: {
              _id: null,
              orderCount: { $sum: 1 },
              grossSales: { $sum: "$totalPrice" },
              headerTaxCollected: { $sum: "$taxCollected" }
            }
          }
        ],
        itemTaxAggregation: [
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: null,
              totalItems: { $sum: 1 },
              unitsSold: { $sum: "$items.quantity" },
              taxableSales: { $sum: { $ifNull: ["$items.taxableValue", 0] } },
              cgst: { $sum: { $ifNull: ["$items.cgst", 0] } },
              sgst: { $sum: { $ifNull: ["$items.sgst", 0] } },
              igst: { $sum: { $ifNull: ["$items.igst", 0] } },
              cess: { $sum: { $ifNull: ["$items.cess", 0] } },
              totalTax: { $sum: { $ifNull: ["$items.totalTax", 0] } },
              unclassifiedHsnCount: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: [{ $ifNull: ["$items.hsn", ""] }, ""] },
                        { $eq: ["$items.hsn", null] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              unknownRateCount: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: [{ $ifNull: ["$items.taxRate", null] }, null] },
                        {
                          $and: [
                            { $eq: ["$items.taxRate", 0] },
                            { $eq: [{ $ifNull: ["$items.taxRuleId", null] }, null] },
                            { $gt: ["$items.taxableValue", 0] }
                          ]
                        }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ],
        byRateBreakdown: [
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: { $ifNull: ["$items.taxRate", "UNKNOWN_RATE"] },
              units: { $sum: "$items.quantity" },
              taxableValue: { $sum: { $ifNull: ["$items.taxableValue", 0] } },
              cgst: { $sum: { $ifNull: ["$items.cgst", 0] } },
              sgst: { $sum: { $ifNull: ["$items.sgst", 0] } },
              igst: { $sum: { $ifNull: ["$items.igst", 0] } },
              cess: { $sum: { $ifNull: ["$items.cess", 0] } },
              totalTax: { $sum: { $ifNull: ["$items.totalTax", 0] } }
            }
          },
          { $sort: { taxableValue: -1 } }
        ],
        byHsnBreakdown: [
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: {
                $cond: [
                  {
                    $or: [
                      { $eq: [{ $ifNull: ["$items.hsn", ""] }, ""] },
                      { $eq: ["$items.hsn", null] }
                    ]
                  },
                  "UNCLASSIFIED_HSN",
                  "$items.hsn"
                ]
              },
              units: { $sum: "$items.quantity" },
              taxableValue: { $sum: { $ifNull: ["$items.taxableValue", 0] } },
              totalTax: { $sum: { $ifNull: ["$items.totalTax", 0] } }
            }
          },
          { $sort: { taxableValue: -1 } },
          { $limit: 10 }
        ],
        geoSplit: [
          {
            $group: {
              _id: "$isInterState",
              taxableValue: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.taxableValue", 0] }] }
                  }
                }
              },
              cgst: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.cgst", 0] }] }
                  }
                }
              },
              sgst: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.sgst", 0] }] }
                  }
                }
              },
              igst: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.igst", 0] }] }
                  }
                }
              },
              cess: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.cess", 0] }] }
                  }
                }
              },
              totalTax: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.totalTax", 0] }] }
                  }
                }
              }
            }
          }
        ],
        monthlyTrend: [
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              orderCount: { $sum: 1 },
              taxableValue: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.taxableValue", 0] }] }
                  }
                }
              },
              totalTax: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.totalTax", 0] }] }
                  }
                }
              }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } }
        ],
        refundExtraction: [
          { $match: { "refunds.0": { $exists: true } } },
          {
            $project: {
              totalPrice: 1,
              taxCollected: 1,
              items: 1,
              refunds: 1
            }
          }
        ]
      }
    }
  ];

  const results = await Order.aggregate(overviewPipeline).allowDiskUse(true);
  const data = results[0] || {};

  const orderSum = data.orderSummary?.[0] || { orderCount: 0, grossSales: 0, headerTaxCollected: 0 };
  const itemTax = data.itemTaxAggregation?.[0] || {
    totalItems: 0,
    unitsSold: 0,
    taxableSales: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    totalTax: 0,
    unclassifiedHsnCount: 0,
    unknownRateCount: 0
  };

  // Calculate refund tax impact attribution from recorded refunds
  let refundedTaxableValue = 0;
  let refundedCgst = 0;
  let refundedSgst = 0;
  let refundedIgst = 0;
  let refundedCess = 0;
  let refundedTotalTax = 0;
  let refundProvenance = "ACTUAL";

  if (Array.isArray(data.refundExtraction)) {
    for (const ord of data.refundExtraction) {
      if (!Array.isArray(ord.refunds)) continue;
      const validRefunds = ord.refunds.filter(r => r.status !== "failed");
      if (validRefunds.length === 0) continue;

      const orderTotal = ord.totalPrice > 0 ? ord.totalPrice : 1;
      const orderItems = ord.items || [];
      const orderItemTotalTax = orderItems.reduce((acc, it) => acc + (it.totalTax || 0), 0);
      const orderItemTaxable = orderItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0);

      for (const ref of validRefunds) {
        const refAmount = ref.amount || 0;
        if (refAmount <= 0) continue;

        if (Array.isArray(ref.refundedItems) && ref.refundedItems.length > 0) {
          // Specific refunded line items
          for (const refIt of ref.refundedItems) {
            const orig = orderItems.find(
              it => (it.product && refIt.product && it.product.toString() === refIt.product.toString()) ||
                    (it.sku && refIt.sku && it.sku === refIt.sku)
            );
            if (orig && orig.quantity > 0) {
              const qtyRatio = Math.min(1, (refIt.quantity || 1) / orig.quantity);
              refundedTaxableValue += (orig.taxableValue || 0) * qtyRatio;
              refundedCgst += (orig.cgst || 0) * qtyRatio;
              refundedSgst += (orig.sgst || 0) * qtyRatio;
              refundedIgst += (orig.igst || 0) * qtyRatio;
              refundedCess += (orig.cess || 0) * qtyRatio;
              refundedTotalTax += (orig.totalTax || 0) * qtyRatio;
            } else {
              // Fallback proportional
              const ratio = Math.min(1, refAmount / orderTotal);
              refundedTaxableValue += orderItemTaxable * ratio;
              refundedTotalTax += orderItemTotalTax * ratio;
            }
          }
        } else {
          // Proportional allocation across order's recorded items
          const ratio = Math.min(1, refAmount / orderTotal);
          refundedTaxableValue += orderItemTaxable * ratio;
          refundedTotalTax += orderItemTotalTax * ratio;
          for (const it of orderItems) {
            refundedCgst += (it.cgst || 0) * ratio;
            refundedSgst += (it.sgst || 0) * ratio;
            refundedIgst += (it.igst || 0) * ratio;
            refundedCess += (it.cess || 0) * ratio;
          }
        }
      }
    }
  }

  // Inter vs Intrastate extraction
  let intrastate = { taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0 };
  let interstate = { taxableValue: 0, igst: 0, totalTax: 0 };

  if (Array.isArray(data.geoSplit)) {
    data.geoSplit.forEach(split => {
      if (split._id === true) {
        interstate = {
          taxableValue: round2(split.taxableValue),
          igst: round2(split.igst),
          totalTax: round2(split.totalTax)
        };
      } else {
        intrastate = {
          taxableValue: round2(split.taxableValue),
          cgst: round2(split.cgst),
          sgst: round2(split.sgst),
          totalTax: round2(split.totalTax)
        };
      }
    });
  }

  // Monthly trend formatting
  const monthlyTrend = (data.monthlyTrend || []).map(m => {
    const monthStr = `${m._id.year}-${String(m._id.month).padStart(2, "0")}`;
    return {
      period: monthStr,
      orderCount: m.orderCount,
      taxableValue: round2(m.taxableValue),
      totalTax: round2(m.totalTax)
    };
  });

  const totalOutputTax = round2(itemTax.totalTax);
  const refundedTax = round2(refundedTotalTax);
  const netOutputTax = round2(totalOutputTax - refundedTax);

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    summary: {
      grossSales: { value: round2(orderSum.grossSales), provenance: "ACTUAL" },
      taxableSales: { value: round2(itemTax.taxableSales), provenance: "ACTUAL" },
      totalOutputTax: { value: totalOutputTax, provenance: "ACTUAL" },
      cgst: { value: round2(itemTax.cgst), provenance: "ACTUAL" },
      sgst: { value: round2(itemTax.sgst), provenance: "ACTUAL" },
      igst: { value: round2(itemTax.igst), provenance: "ACTUAL" },
      cess: { value: round2(itemTax.cess), provenance: "ACTUAL" },
      refundImpact: {
        refundedTaxableValue: round2(refundedTaxableValue),
        refundedCgst: round2(refundedCgst),
        refundedSgst: round2(refundedSgst),
        refundedIgst: round2(refundedIgst),
        refundedCess: round2(refundedCess),
        refundedTotalTax: refundedTax,
        provenance: refundProvenance
      },
      netOutputTax: { value: netOutputTax, provenance: "DERIVED" },
      shippingTax: {
        value: 0,
        provenance: "UNKNOWN",
        note: "Shipping tax is not captured as an immutable line item snapshot; excluded from artificial output tax totals"
      }
    },
    breakdowns: {
      byRate: (data.byRateBreakdown || []).map(r => ({
        taxRate: r._id,
        units: r.units,
        taxableValue: round2(r.taxableValue),
        cgst: round2(r.cgst),
        sgst: round2(r.sgst),
        igst: round2(r.igst),
        cess: round2(r.cess),
        totalTax: round2(r.totalTax),
        provenance: r._id === "UNKNOWN_RATE" ? "UNKNOWN" : "ACTUAL"
      })),
      byHsn: (data.byHsnBreakdown || []).map(h => ({
        hsn: h._id,
        units: h.units,
        taxableValue: round2(h.taxableValue),
        totalTax: round2(h.totalTax),
        provenance: h._id === "UNCLASSIFIED_HSN" ? "UNKNOWN" : "ACTUAL"
      })),
      interstateVsIntrastate: {
        intrastate,
        interstate
      },
      monthlyTrend
    },
    provenanceSummary: {
      orderCount: orderSum.orderCount,
      totalItemsCount: itemTax.totalItems,
      unclassifiedHsnCount: itemTax.unclassifiedHsnCount,
      unknownRateCount: itemTax.unknownRateCount
    }
  };
}

/**
 * 2. GET HSN ANALYTICS
 * Line-item HSN aggregation with units, taxable values, component taxes, and unclassified safety.
 */
async function getHsnAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const hsnPipeline = [
    { $match: matchFilter },
    { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
    {
      $project: {
        hsn: {
          $cond: [
            {
              $or: [
                { $eq: [{ $ifNull: ["$items.hsn", ""] }, ""] },
                { $eq: ["$items.hsn", null] }
              ]
            },
            "UNCLASSIFIED_HSN",
            "$items.hsn"
          ]
        },
        product: "$items.product",
        quantity: { $ifNull: ["$items.quantity", 0] },
        taxableValue: { $ifNull: ["$items.taxableValue", 0] },
        cgst: { $ifNull: ["$items.cgst", 0] },
        sgst: { $ifNull: ["$items.sgst", 0] },
        igst: { $ifNull: ["$items.igst", 0] },
        cess: { $ifNull: ["$items.cess", 0] },
        totalTax: { $ifNull: ["$items.totalTax", 0] }
      }
    },
    {
      $group: {
        _id: "$hsn",
        products: { $addToSet: "$product" },
        unitsSold: { $sum: "$quantity" },
        taxableValue: { $sum: "$taxableValue" },
        cgst: { $sum: "$cgst" },
        sgst: { $sum: "$sgst" },
        igst: { $sum: "$igst" },
        cess: { $sum: "$cess" },
        totalTax: { $sum: "$totalTax" }
      }
    },
    { $sort: { taxableValue: -1 } }
  ];

  const results = await Order.aggregate(hsnPipeline).allowDiskUse(true);

  let grandTaxable = 0;
  let grandTax = 0;
  let unclassifiedUnits = 0;

  const hsnRecords = results.map(rec => {
    const isUnclassified = rec._id === "UNCLASSIFIED_HSN";
    const taxable = round2(rec.taxableValue);
    const tax = round2(rec.totalTax);
    grandTaxable += taxable;
    grandTax += tax;
    if (isUnclassified) unclassifiedUnits += rec.unitsSold;

    return {
      hsn: rec._id,
      productCount: Array.isArray(rec.products) ? rec.products.filter(Boolean).length : 0,
      unitsSold: rec.unitsSold,
      taxableValue: taxable,
      cgst: round2(rec.cgst),
      sgst: round2(rec.sgst),
      igst: round2(rec.igst),
      cess: round2(rec.cess),
      totalTax: tax,
      provenance: isUnclassified ? "UNKNOWN" : "ACTUAL"
    };
  });

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    hsnRecords,
    summary: {
      totalHsns: hsnRecords.length,
      unclassifiedCount: unclassifiedUnits,
      totalTaxableValue: round2(grandTaxable),
      totalTax: round2(grandTax)
    }
  };
}

/**
 * 3. GET STATE / PLACE OF SUPPLY ANALYTICS
 * State tax distribution, interstate vs intrastate breakdowns, missing state handling.
 */
async function getStateAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const statePipeline = [
    { $match: matchFilter },
    {
      $project: {
        state: {
          $cond: [
            {
              $or: [
                { $eq: [{ $ifNull: ["$financialSnapshot.placeOfSupply", ""] }, ""] },
                { $eq: ["$financialSnapshot.placeOfSupply", null] }
              ]
            },
            {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $ifNull: ["$shippingAddress.state", ""] }, ""] },
                    { $eq: ["$shippingAddress.state", null] }
                  ]
                },
                "UNKNOWN_STATE",
                "$shippingAddress.state"
              ]
            },
            "$financialSnapshot.placeOfSupply"
          ]
        },
        isInterState: { $ifNull: ["$financialSnapshot.isInterState", false] },
        items: 1
      }
    },
    {
      $group: {
        _id: {
          state: "$state",
          isInterState: "$isInterState"
        },
        orderCount: { $sum: 1 },
        taxableSales: {
          $sum: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.taxableValue", 0] }] }
            }
          }
        },
        cgst: {
          $sum: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.cgst", 0] }] }
            }
          }
        },
        sgst: {
          $sum: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.sgst", 0] }] }
            }
          }
        },
        igst: {
          $sum: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.igst", 0] }] }
            }
          }
        },
        cess: {
          $sum: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.cess", 0] }] }
            }
          }
        },
        totalTax: {
          $sum: {
            $reduce: {
              input: { $ifNull: ["$items", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.totalTax", 0] }] }
            }
          }
        }
      }
    },
    { $sort: { taxableSales: -1 } }
  ];

  const results = await Order.aggregate(statePipeline).allowDiskUse(true);

  let intrastateTaxable = 0;
  let intrastateTax = 0;
  let interstateTaxable = 0;
  let interstateTax = 0;

  const stateRecords = results.map(r => {
    const isUnknown = r._id.state === "UNKNOWN_STATE";
    const classification = isUnknown ? "UNKNOWN" : (r._id.isInterState ? "INTERSTATE" : "INTRASTATE");
    const taxable = round2(r.taxableSales);
    const tax = round2(r.totalTax);

    if (classification === "INTRASTATE") {
      intrastateTaxable += taxable;
      intrastateTax += tax;
    } else if (classification === "INTERSTATE") {
      interstateTaxable += taxable;
      interstateTax += tax;
    }

    return {
      state: r._id.state,
      classification,
      orderCount: r.orderCount,
      taxableSales: taxable,
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
      cess: round2(r.cess),
      totalTax: tax,
      provenance: isUnknown ? "UNKNOWN" : "ACTUAL"
    };
  });

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    stateRecords,
    summary: {
      intrastateTaxable: round2(intrastateTaxable),
      intrastateTax: round2(intrastateTax),
      interstateTaxable: round2(interstateTaxable),
      interstateTax: round2(interstateTax),
      totalTaxable: round2(intrastateTaxable + interstateTaxable),
      totalTax: round2(intrastateTax + interstateTax)
    }
  };
}

/**
 * 4. GET TAX RATE ANALYTICS
 * Rate distribution from line-item snapshots without reconstructing or forcing rules.
 */
async function getRateAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const matchFilter = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const ratePipeline = [
    { $match: matchFilter },
    { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
    {
      $project: {
        orderId: "$_id",
        taxRate: {
          $cond: [
            {
              $or: [
                { $eq: [{ $ifNull: ["$items.taxRate", null] }, null] },
                {
                  $and: [
                    { $eq: ["$items.taxRate", 0] },
                    { $eq: [{ $ifNull: ["$items.taxRuleId", null] }, null] },
                    { $gt: ["$items.taxableValue", 0] }
                  ]
                }
              ]
            },
            "UNKNOWN_RATE",
            "$items.taxRate"
          ]
        },
        quantity: { $ifNull: ["$items.quantity", 0] },
        taxableValue: { $ifNull: ["$items.taxableValue", 0] },
        cgst: { $ifNull: ["$items.cgst", 0] },
        sgst: { $ifNull: ["$items.sgst", 0] },
        igst: { $ifNull: ["$items.igst", 0] },
        cess: { $ifNull: ["$items.cess", 0] },
        totalTax: { $ifNull: ["$items.totalTax", 0] }
      }
    },
    {
      $group: {
        _id: "$taxRate",
        orderSet: { $addToSet: "$orderId" },
        unitsSold: { $sum: "$quantity" },
        taxableValue: { $sum: "$taxableValue" },
        cgst: { $sum: "$cgst" },
        sgst: { $sum: "$sgst" },
        igst: { $sum: "$igst" },
        cess: { $sum: "$cess" },
        totalTax: { $sum: "$totalTax" }
      }
    },
    { $sort: { taxableValue: -1 } }
  ];

  const results = await Order.aggregate(ratePipeline).allowDiskUse(true);

  let grandTaxable = 0;
  let grandTax = 0;
  let unknownRateUnits = 0;

  const rateRecords = results.map(r => {
    const isUnknown = r._id === "UNKNOWN_RATE";
    const taxable = round2(r.taxableValue);
    const tax = round2(r.totalTax);
    grandTaxable += taxable;
    grandTax += tax;
    if (isUnknown) unknownRateUnits += r.unitsSold;

    return {
      taxRate: r._id,
      orderCount: Array.isArray(r.orderSet) ? r.orderSet.length : 0,
      unitsSold: r.unitsSold,
      taxableValue: taxable,
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
      cess: round2(r.cess),
      totalTax: tax,
      provenance: isUnknown ? "UNKNOWN" : "ACTUAL"
    };
  });

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    rateRecords,
    summary: {
      totalRates: rateRecords.length,
      unknownRateUnits,
      totalTaxableValue: round2(grandTaxable),
      totalTax: round2(grandTax)
    }
  };
}

/**
 * 5. GET INPUT GST / ITC ANALYTICS
 * Expense ledger input tax aggregation and ITC tracking (Managerial tracking only).
 */
async function getInputTaxAnalytics({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const matchFilter = {
    expenseDate: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const expensePipeline = [
    { $match: matchFilter },
    {
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              totalExpenses: { $sum: 1 },
              totalGross: { $sum: "$grossAmount" },
              totalTaxable: { $sum: "$taxableAmount" },
              totalGst: { $sum: "$totalGst" },
              cgst: { $sum: "$cgst" },
              sgst: { $sum: "$sgst" },
              igst: { $sum: "$igst" },
              cess: { $sum: "$cess" },
              eligibleItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "eligible"] }, "$itcAmount", 0]
                }
              },
              pendingVerificationItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "pending_verification"] }, "$totalGst", 0]
                }
              },
              blockedItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "blocked"] }, "$totalGst", 0]
                }
              },
              ineligibleItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "ineligible"] }, "$totalGst", 0]
                }
              },
              itcClaimedAmount: {
                $sum: {
                  $cond: [{ $eq: ["$itcClaimed", true] }, "$itcAmount", 0]
                }
              }
            }
          }
        ],
        byCategory: [
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              taxableAmount: { $sum: "$taxableAmount" },
              totalGst: { $sum: "$totalGst" },
              eligibleItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "eligible"] }, "$itcAmount", 0]
                }
              },
              blockedItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "blocked"] }, "$totalGst", 0]
                }
              },
              ineligibleItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "ineligible"] }, "$totalGst", 0]
                }
              }
            }
          },
          { $sort: { totalGst: -1 } }
        ],
        byVendor: [
          {
            $group: {
              _id: "$vendor.name",
              gstin: { $first: "$vendor.gstin" },
              count: { $sum: 1 },
              taxableAmount: { $sum: "$taxableAmount" },
              totalGst: { $sum: "$totalGst" },
              eligibleItc: {
                $sum: {
                  $cond: [{ $eq: ["$itcEligibility", "eligible"] }, "$itcAmount", 0]
                }
              }
            }
          },
          { $sort: { totalGst: -1 } },
          { $limit: 20 }
        ]
      }
    }
  ];

  const results = await Expense.aggregate(expensePipeline).allowDiskUse(true);
  const data = results[0] || {};
  const overall = data.overall?.[0] || {
    totalExpenses: 0,
    totalGross: 0,
    totalTaxable: 0,
    totalGst: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    eligibleItc: 0,
    pendingVerificationItc: 0,
    blockedItc: 0,
    ineligibleItc: 0,
    itcClaimedAmount: 0
  };

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    summary: {
      totalExpenses: overall.totalExpenses,
      totalExpenseGross: round2(overall.totalGross),
      totalExpenseTaxable: round2(overall.totalTaxable),
      totalExpenseGst: round2(overall.totalGst),
      eligibleItc: round2(overall.eligibleItc),
      pendingVerificationItc: round2(overall.pendingVerificationItc),
      blockedItc: round2(overall.blockedItc),
      ineligibleItc: round2(overall.ineligibleItc),
      itcClaimedAmount: round2(overall.itcClaimedAmount)
    },
    byTaxComponent: {
      cgst: round2(overall.cgst),
      sgst: round2(overall.sgst),
      igst: round2(overall.igst),
      cess: round2(overall.cess),
      totalGst: round2(overall.totalGst)
    },
    byCategory: (data.byCategory || []).map(cat => ({
      category: cat._id,
      count: cat.count,
      taxableAmount: round2(cat.taxableAmount),
      totalGst: round2(cat.totalGst),
      eligibleItc: round2(cat.eligibleItc),
      blockedItc: round2(cat.blockedItc),
      ineligibleItc: round2(cat.ineligibleItc),
      provenance: "DERIVED"
    })),
    byVendor: (data.byVendor || []).map(v => ({
      vendorName: v._id,
      gstin: v.gstin || "",
      count: v.count,
      taxableAmount: round2(v.taxableAmount),
      totalGst: round2(v.totalGst),
      eligibleItc: round2(v.eligibleItc),
      provenance: "DERIVED"
    })),
    disclosures: [
      "Input GST and ITC tracking is for internal managerial accounting only.",
      "Statutory ITC eligibility requires verification against supplier filing and GSTR-2B matching.",
      "Legal eligibility determinations are not made automatically."
    ]
  };
}

/**
 * 6. GET TAX DATA QUALITY
 * Deterministic anomaly detection across historical order snapshots and expense records.
 */
async function getTaxDataQuality({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const orderMatch = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const expenseMatch = {
    expenseDate: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  // Fetch all TaxRules for verification map
  const taxRules = await TaxRule.find({}).lean();
  const taxRuleMap = new Map();
  taxRules.forEach(r => taxRuleMap.set(r._id.toString(), r));

  // Stream/find orders with only relevant tax fields
  const orders = await Order.find(orderMatch)
    .select("_id orderNumber createdAt items pricing financialSnapshot shippingAddress")
    .lean();

  // Stream/find expenses with only relevant tax fields
  const expenses = await Expense.find(expenseMatch)
    .select("_id expenseDate category vendor taxableAmount cgst sgst igst cess totalGst grossAmount itcEligibility itcAmount status")
    .lean();

  const anomalies = [];
  const countsByCode = {
    ERR_MISSING_HSN: 0,
    ERR_MISSING_TAXABLE_VAL: 0,
    ERR_TAX_SUM_MISMATCH: 0,
    ERR_NEGATIVE_TAX: 0,
    ERR_INVALID_GEO_SPLIT: 0,
    ERR_MISSING_POS: 0,
    ERR_UNVERIFIED_RULE: 0,
    ERR_EXPENSE_GST_MISMATCH: 0,
    ERR_INVALID_ITC_AMOUNT: 0
  };

  function recordAnomaly({ code, severity, entityType, entityId, orderNumber, description, details, provenance }) {
    countsByCode[code] = (countsByCode[code] || 0) + 1;
    anomalies.push({
      code,
      severity,
      entityType,
      entityId: entityId ? entityId.toString() : null,
      orderNumber: orderNumber || undefined,
      description,
      details: details || {},
      provenance: provenance || "UNKNOWN"
    });
  }

  // --- 1. Audit Orders ---
  for (const ord of orders) {
    const items = ord.items || [];
    const isInterState = ord.financialSnapshot?.isInterState ?? false;
    const pos = ord.financialSnapshot?.placeOfSupply || "";
    const headerTax = ord.financialSnapshot?.taxCollected ?? (ord.pricing?.tax ?? 0);

    // Check 6: ERR_MISSING_POS
    if (!pos || !pos.trim()) {
      recordAnomaly({
        code: "ERR_MISSING_POS",
        severity: "MEDIUM",
        entityType: "order",
        entityId: ord._id,
        orderNumber: ord.orderNumber,
        description: "Order is missing Place of Supply state in financial snapshot",
        details: {
          shippingState: ord.shippingAddress?.state || "UNKNOWN",
          recordedPOS: pos
        },
        provenance: "UNKNOWN"
      });
    }

    let orderItemTaxSum = 0;
    let orderItemTotalTaxSum = 0;

    items.forEach((it, idx) => {
      const lineTotalTax = it.totalTax || 0;
      const compTax = (it.cgst || 0) + (it.sgst || 0) + (it.igst || 0) + (it.cess || 0);
      orderItemTaxSum += compTax;
      orderItemTotalTaxSum += lineTotalTax;

      // Check 1: ERR_MISSING_HSN
      if (!it.hsn || !it.hsn.trim()) {
        recordAnomaly({
          code: "ERR_MISSING_HSN",
          severity: "HIGH",
          entityType: "order",
          entityId: ord._id,
          orderNumber: ord.orderNumber,
          description: `Line item #${idx + 1} (${it.sku || it.name || "Product"}) is missing an HSN code`,
          details: {
            lineIndex: idx,
            sku: it.sku || "",
            productName: it.name || "",
            price: it.price,
            quantity: it.quantity
          },
          provenance: "UNKNOWN"
        });
      }

      // Check 2: ERR_MISSING_TAXABLE_VAL
      if ((it.taxableValue === null || it.taxableValue === undefined || it.taxableValue <= 0) && (it.price > 0)) {
        recordAnomaly({
          code: "ERR_MISSING_TAXABLE_VAL",
          severity: "CRITICAL",
          entityType: "order",
          entityId: ord._id,
          orderNumber: ord.orderNumber,
          description: `Line item #${idx + 1} has zero or missing taxable value for a paid product`,
          details: {
            lineIndex: idx,
            sku: it.sku || "",
            price: it.price,
            taxableValue: it.taxableValue
          },
          provenance: "UNKNOWN"
        });
      }

      // Check 4: ERR_NEGATIVE_TAX
      const negativeFields = [];
      if (it.taxableValue < 0) negativeFields.push(`taxableValue: ${it.taxableValue}`);
      if (it.taxRate < 0) negativeFields.push(`taxRate: ${it.taxRate}`);
      if (it.cgst < 0) negativeFields.push(`cgst: ${it.cgst}`);
      if (it.sgst < 0) negativeFields.push(`sgst: ${it.sgst}`);
      if (it.igst < 0) negativeFields.push(`igst: ${it.igst}`);
      if (it.cess < 0) negativeFields.push(`cess: ${it.cess}`);
      if (it.totalTax < 0) negativeFields.push(`totalTax: ${it.totalTax}`);

      if (negativeFields.length > 0) {
        recordAnomaly({
          code: "ERR_NEGATIVE_TAX",
          severity: "CRITICAL",
          entityType: "order",
          entityId: ord._id,
          orderNumber: ord.orderNumber,
          description: `Line item #${idx + 1} contains impossible negative tax components`,
          details: {
            lineIndex: idx,
            negativeFields
          },
          provenance: "UNRECONCILED"
        });
      }

      // Check 5: ERR_INVALID_GEO_SPLIT
      if (isInterState && ((it.cgst > 0) || (it.sgst > 0))) {
        recordAnomaly({
          code: "ERR_INVALID_GEO_SPLIT",
          severity: "HIGH",
          entityType: "order",
          entityId: ord._id,
          orderNumber: ord.orderNumber,
          description: `Interstate order contains intrastate CGST (${it.cgst}) or SGST (${it.sgst}) on line #${idx + 1}`,
          details: {
            lineIndex: idx,
            isInterState: true,
            cgst: it.cgst,
            sgst: it.sgst,
            igst: it.igst
          },
          provenance: "UNRECONCILED"
        });
      } else if (!isInterState && (it.igst > 0)) {
        recordAnomaly({
          code: "ERR_INVALID_GEO_SPLIT",
          severity: "HIGH",
          entityType: "order",
          entityId: ord._id,
          orderNumber: ord.orderNumber,
          description: `Intrastate order contains interstate IGST (${it.igst}) on line #${idx + 1}`,
          details: {
            lineIndex: idx,
            isInterState: false,
            cgst: it.cgst,
            sgst: it.sgst,
            igst: it.igst
          },
          provenance: "UNRECONCILED"
        });
      }

      // Check 7: ERR_UNVERIFIED_RULE
      if (it.taxRuleId) {
        const rule = taxRuleMap.get(it.taxRuleId.toString());
        if (!rule) {
          recordAnomaly({
            code: "ERR_UNVERIFIED_RULE",
            severity: "MEDIUM",
            entityType: "order",
            entityId: ord._id,
            orderNumber: ord.orderNumber,
            description: `Line item #${idx + 1} references non-existent TaxRule ID ${it.taxRuleId}`,
            details: { lineIndex: idx, taxRuleId: it.taxRuleId, status: "missing" },
            provenance: "UNKNOWN"
          });
        } else if (!rule.verifiedByAccountant || !rule.isActive) {
          recordAnomaly({
            code: "ERR_UNVERIFIED_RULE",
            severity: "MEDIUM",
            entityType: "order",
            entityId: ord._id,
            orderNumber: ord.orderNumber,
            description: `Line item #${idx + 1} references an unverified or inactive TaxRule (${rule.ruleCode || rule.name})`,
            details: {
              lineIndex: idx,
              ruleCode: rule.ruleCode,
              isActive: rule.isActive,
              verifiedByAccountant: rule.verifiedByAccountant
            },
            provenance: "UNKNOWN"
          });
        }
      }

      // Check 3A: Line item component mismatch
      if (Math.abs(compTax - lineTotalTax) > 0.05) {
        recordAnomaly({
          code: "ERR_TAX_SUM_MISMATCH",
          severity: "CRITICAL",
          entityType: "order",
          entityId: ord._id,
          orderNumber: ord.orderNumber,
          description: `Line item #${idx + 1} components sum (${round2(compTax)}) does not equal totalTax (${round2(lineTotalTax)})`,
          details: {
            lineIndex: idx,
            componentSum: round2(compTax),
            lineTotalTax: round2(lineTotalTax),
            difference: round2(Math.abs(compTax - lineTotalTax))
          },
          provenance: "UNRECONCILED"
        });
      }
    });

    // Check 3B: Order header vs sum of items totalTax mismatch
    if (Math.abs(orderItemTotalTaxSum - headerTax) > 0.05 && headerTax > 0) {
      recordAnomaly({
        code: "ERR_TAX_SUM_MISMATCH",
        severity: "CRITICAL",
        entityType: "order",
        entityId: ord._id,
        orderNumber: ord.orderNumber,
        description: `Order header taxCollected (${round2(headerTax)}) does not equal sum of items totalTax (${round2(orderItemTotalTaxSum)})`,
        details: {
          headerTaxCollected: round2(headerTax),
          sumItemsTotalTax: round2(orderItemTotalTaxSum),
          difference: round2(Math.abs(orderItemTotalTaxSum - headerTax))
        },
        provenance: "UNRECONCILED"
      });
    }
  }

  // --- 2. Audit Expenses ---
  for (const exp of expenses) {
    const compGst = (exp.cgst || 0) + (exp.sgst || 0) + (exp.igst || 0) + (exp.cess || 0);
    const totalGst = exp.totalGst || 0;
    const itcAmount = exp.itcAmount || 0;
    const eligibility = exp.itcEligibility || "pending_verification";

    // Check 8: ERR_EXPENSE_GST_MISMATCH
    if (Math.abs(compGst - totalGst) > 0.05) {
      recordAnomaly({
        code: "ERR_EXPENSE_GST_MISMATCH",
        severity: "HIGH",
        entityType: "expense",
        entityId: exp._id,
        description: `Expense (${exp.vendor?.name || exp.category}) components sum (${round2(compGst)}) does not equal totalGst (${round2(totalGst)})`,
        details: {
          vendor: exp.vendor?.name || "",
          category: exp.category,
          componentSum: round2(compGst),
          totalGst: round2(totalGst),
          difference: round2(Math.abs(compGst - totalGst))
        },
        provenance: "UNRECONCILED"
      });
    }

    // Check 9: ERR_INVALID_ITC_AMOUNT
    if (itcAmount < 0) {
      recordAnomaly({
        code: "ERR_INVALID_ITC_AMOUNT",
        severity: "HIGH",
        entityType: "expense",
        entityId: exp._id,
        description: `Expense contains impossible negative ITC amount (${itcAmount})`,
        details: { itcAmount, totalGst, itcEligibility: eligibility },
        provenance: "UNRECONCILED"
      });
    } else if (itcAmount > totalGst + 0.05) {
      recordAnomaly({
        code: "ERR_INVALID_ITC_AMOUNT",
        severity: "HIGH",
        entityType: "expense",
        entityId: exp._id,
        description: `Expense ITC amount (${round2(itcAmount)}) exceeds total GST paid (${round2(totalGst)})`,
        details: { itcAmount: round2(itcAmount), totalGst: round2(totalGst), itcEligibility: eligibility },
        provenance: "UNRECONCILED"
      });
    } else if (["ineligible", "blocked"].includes(eligibility) && itcAmount > 0) {
      recordAnomaly({
        code: "ERR_INVALID_ITC_AMOUNT",
        severity: "HIGH",
        entityType: "expense",
        entityId: exp._id,
        description: `Expense flagged as ${eligibility} has non-zero claimable ITC (${round2(itcAmount)})`,
        details: { itcEligibility: eligibility, itcAmount: round2(itcAmount), totalGst: round2(totalGst) },
        provenance: "UNRECONCILED"
      });
    }
  }

  const criticalCount = anomalies.filter(a => a.severity === "CRITICAL").length;
  const highCount = anomalies.filter(a => a.severity === "HIGH").length;
  const mediumCount = anomalies.filter(a => a.severity === "MEDIUM").length;

  let healthStatus = "CLEAN";
  if (criticalCount > 0) healthStatus = "CRITICAL";
  else if (highCount > 0 || mediumCount > 0) healthStatus = "WARNING";

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    summary: {
      totalOrdersAudited: orders.length,
      totalExpensesAudited: expenses.length,
      totalAnomalies: anomalies.length,
      criticalCount,
      highCount,
      mediumCount,
      healthStatus
    },
    anomalyCountsByCode: countsByCode,
    anomalies: anomalies.slice(0, 100), // capped for response performance
    disclosures: [
      "Tax Data Quality is a non-mutating management audit tool.",
      "Anomalies indicate data inconsistencies or legacy gaps; historical records are never modified automatically.",
      "ITC tracking reflects internal operational classification and does not replace statutory audit."
    ]
  };
}

/**
 * 7. GET TAX RECONCILIATION
 * Multi-stream management reconciliation: Order tax snapshots, Refunds, Expense GST, and ITC.
 */
async function getTaxReconciliation({ startDate, endDate } = {}) {
  const { start, end } = parseTaxDateRange(startDate, endDate);

  const orderMatch = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" },
    orderStatus: { $ne: "Cancelled" }
  };

  const expenseMatch = {
    expenseDate: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const orders = await Order.find(orderMatch)
    .select("_id orderNumber createdAt items pricing financialSnapshot refunds")
    .lean();

  const expenses = await Expense.find(expenseMatch)
    .select("_id category vendor taxableAmount cgst sgst igst cess totalGst itcEligibility itcAmount itcClaimed")
    .lean();

  // A. Order Tax Reconciliation
  let ordersChecked = orders.length;
  let ordersReconciled = 0;
  let ordersWithMismatch = 0;
  let itemTaxTotal = 0;
  let headerTaxTotal = 0;

  // B. Refund Tax Reconciliation
  let refundsChecked = 0;
  let expectedRefundTaxTotal = 0;
  let recordedRefundTaxTotal = 0;
  let refundProvenance = "ACTUAL";

  for (const ord of orders) {
    const items = ord.items || [];
    const headerTax = ord.financialSnapshot?.taxCollected ?? (ord.pricing?.tax ?? 0);
    headerTaxTotal += headerTax;

    let ordItemTax = 0;
    let ordCompTax = 0;
    let hasLineMismatch = false;

    for (const it of items) {
      const comp = (it.cgst || 0) + (it.sgst || 0) + (it.igst || 0) + (it.cess || 0);
      const tot = it.totalTax || 0;
      ordItemTax += tot;
      ordCompTax += comp;
      if (Math.abs(comp - tot) > 0.05) {
        hasLineMismatch = true;
      }
    }
    itemTaxTotal += ordItemTax;

    const hasHeaderMismatch = Math.abs(ordItemTax - headerTax) > 0.05 && headerTax > 0;
    if (hasLineMismatch || hasHeaderMismatch) {
      ordersWithMismatch++;
    } else {
      ordersReconciled++;
    }

    // Process refunds on this order
    const validRefunds = (ord.refunds || []).filter(r => r.status !== "failed");
    if (validRefunds.length > 0) {
      const orderTotal = ord.pricing?.total || ord.totalPrice || 1;
      for (const ref of validRefunds) {
        refundsChecked++;
        const refAmount = ref.amount || 0;

        if (Array.isArray(ref.refundedItems) && ref.refundedItems.length > 0) {
          for (const refIt of ref.refundedItems) {
            const orig = items.find(
              it => (it.product && refIt.product && it.product.toString() === refIt.product.toString()) ||
                    (it.sku && refIt.sku && it.sku === refIt.sku)
            );
            if (orig && orig.quantity > 0) {
              const ratio = Math.min(1, (refIt.quantity || 1) / orig.quantity);
              const refTax = (orig.totalTax || 0) * ratio;
              expectedRefundTaxTotal += refTax;
              recordedRefundTaxTotal += refTax;
            } else {
              const ratio = Math.min(1, refAmount / orderTotal);
              expectedRefundTaxTotal += ordItemTax * ratio;
              recordedRefundTaxTotal += ordItemTax * ratio;
              refundProvenance = "UNKNOWN";
            }
          }
        } else {
          const ratio = Math.min(1, refAmount / orderTotal);
          expectedRefundTaxTotal += ordItemTax * ratio;
          recordedRefundTaxTotal += ordItemTax * ratio;
        }
      }
    }
  }

  const orderTaxDifference = round2(Math.abs(itemTaxTotal - headerTaxTotal));
  const orderTaxStatus = orderTaxDifference <= 0.05 ? "RECONCILED" : "MISMATCH";

  const refundTaxDifference = round2(Math.abs(expectedRefundTaxTotal - recordedRefundTaxTotal));
  const refundTaxStatus = refundTaxDifference <= 0.05 ? "RECONCILED" : "MISMATCH";

  // C. Expense GST Reconciliation
  let expensesChecked = expenses.length;
  let expensesReconciled = 0;
  let expensesWithMismatch = 0;
  let componentGstTotal = 0;
  let recordedTotalGst = 0;

  // D. ITC Reconciliation
  let eligibleItc = 0;
  let blockedItc = 0;
  let ineligibleItc = 0;
  let pendingVerificationItc = 0;
  let invalidItc = 0;
  let claimedItc = 0;

  for (const exp of expenses) {
    const compGst = (exp.cgst || 0) + (exp.sgst || 0) + (exp.igst || 0) + (exp.cess || 0);
    const totGst = exp.totalGst || 0;
    const itcAmount = exp.itcAmount || 0;
    const eligibility = exp.itcEligibility || "pending_verification";

    componentGstTotal += compGst;
    recordedTotalGst += totGst;

    if (Math.abs(compGst - totGst) > 0.05) {
      expensesWithMismatch++;
    } else {
      expensesReconciled++;
    }

    if (eligibility === "eligible") {
      if (itcAmount > totGst + 0.05 || itcAmount < 0) {
        invalidItc += itcAmount;
      } else {
        eligibleItc += itcAmount;
      }
    } else if (eligibility === "blocked") {
      blockedItc += totGst;
      if (itcAmount > 0) invalidItc += itcAmount;
    } else if (eligibility === "ineligible") {
      ineligibleItc += totGst;
      if (itcAmount > 0) invalidItc += itcAmount;
    } else if (eligibility === "pending_verification") {
      pendingVerificationItc += totGst;
    }

    if (exp.itcClaimed) {
      claimedItc += itcAmount;
    }
  }

  const expenseGstDifference = round2(Math.abs(componentGstTotal - recordedTotalGst));
  const expenseGstStatus = expenseGstDifference <= 0.05 ? "RECONCILED" : "MISMATCH";

  return {
    dateRange: {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    },
    provenance: "DERIVED",
    orderTaxReconciliation: {
      ordersChecked,
      ordersReconciled,
      ordersWithMismatch,
      itemTaxTotal: round2(itemTaxTotal),
      headerTaxTotal: round2(headerTaxTotal),
      difference: orderTaxDifference,
      status: orderTaxStatus,
      provenance: "DERIVED"
    },
    refundTaxReconciliation: {
      refundsChecked,
      expectedRefundTaxTotal: round2(expectedRefundTaxTotal),
      recordedRefundTaxTotal: round2(recordedRefundTaxTotal),
      difference: refundTaxDifference,
      status: refundTaxStatus,
      provenance: refundProvenance
    },
    expenseGstReconciliation: {
      expensesChecked,
      expensesReconciled,
      expensesWithMismatch,
      componentGstTotal: round2(componentGstTotal),
      recordedTotalGst: round2(recordedTotalGst),
      difference: expenseGstDifference,
      status: expenseGstStatus,
      provenance: "DERIVED"
    },
    itcReconciliation: {
      eligibleItc: round2(eligibleItc),
      blockedItc: round2(blockedItc),
      ineligibleItc: round2(ineligibleItc),
      pendingVerificationItc: round2(pendingVerificationItc),
      invalidItc: round2(invalidItc),
      claimedItc: round2(claimedItc),
      totalExpenseGst: round2(recordedTotalGst),
      provenance: "DERIVED"
    },
    shippingGstReconciliation: {
      status: "NOT_AVAILABLE",
      provenance: "UNKNOWN",
      note: "Shipping GST is not captured as an immutable line-item snapshot in historical order records"
    },
    disclosures: [
      "Management Tax Reconciliation compares internal ledgers and immutable snapshots.",
      "This is not a statutory reconciliation with GSTN, GSTR-1, or GSTR-2B.",
      "Pending verification ITC is strictly separated from eligible/claimable figures."
    ]
  };
}

module.exports = {
  parseTaxDateRange,
  getTaxOverview,
  getHsnAnalytics,
  getStateAnalytics,
  getRateAnalytics,
  getInputTaxAnalytics,
  getTaxDataQuality,
  getTaxReconciliation
};
