const ExcelJS = require("exceljs");

/**
 * Escapes strings that could trigger spreadsheet formula execution if opened in Excel.
 */
function sanitizeCellValue(val) {
  if (val === null || val === undefined) {
    return "";
  }
  if (typeof val === "number" || typeof val === "boolean" || val instanceof Date) {
    return val;
  }
  const str = String(val);
  // Protect against Excel formula injection: =, +, -, @
  if (str.length > 0 && ["=", "+", "-", "@"].includes(str.trim()[0])) {
    return `'${str}`;
  }
  return str;
}

/**
 * Format key names into human readable header titles
 */
function formatHeaderLabel(key) {
  if (!key) return "";
  // Specific financial abbreviations
  const map = {
    grossMerchandiseSales: "GMS (₹)",
    productDiscounts: "Product Discounts (₹)",
    couponDiscounts: "Coupon Discounts (₹)",
    couponAllocated: "Allocated Coupons (₹)",
    netMerchandiseSales: "Net Merchandise Sales (₹)",
    shippingRevenue: "Shipping Revenue (₹)",
    refunds: "Refunds (₹)",
    netRevenue: "Net Revenue (₹)",
    knownCogs: "Known COGS (₹)",
    estimatedCogs: "Estimated COGS (₹)",
    totalCogs: "Total COGS (₹)",
    unknownCostUnits: "Unknown Cost Units",
    cogsCoveragePercent: "COGS Coverage (%)",
    grossProfit: "Gross Profit (₹)",
    grossMarginPercent: "Gross Margin (%)",
    gatewayFee: "Gateway Fee (₹)",
    freightCost: "Freight Cost (₹)",
    contributionProfit: "Contribution Profit (₹)",
    contributionMarginPercent: "Contribution Margin (%)",
    taxCollected: "Tax Collected (₹)",
    unitsSold: "Units Sold",
    orderCount: "Order Count",
    orderNumber: "Order Number",
    orderId: "Order ID",
    productId: "Product ID",
    sku: "SKU",
    name: "Product Name",
    category: "Category",
    gender: "Gender",
    channel: "Channel",
    channelLabel: "Channel Name",
    paymentMethod: "Payment Method",
    date: "Date",
    createdAt: "Created At",
    status: "Status",
    provenance: "Data Provenance",
    cogsStatus: "COGS Status",
    taxableAmount: "Taxable Amount (₹)",
    cgst: "CGST (₹)",
    sgst: "SGST (₹)",
    igst: "IGST (₹)",
    totalGst: "Total GST (₹)",
    grossAmount: "Gross Amount (₹)",
    itcEligibility: "ITC Eligibility",
    itcAmount: "ITC Amount (₹)",
    vendor: "Vendor",
    description: "Description"
  };

  if (map[key]) return map[key];

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Generates an Excel Workbook from structured report results
 */
async function generateXlsx(reportData) {
  const { reportMetadata = {}, summary = {}, results = [], disclosures = [] } = reportData;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LYVO Management Analytics";
  workbook.lastModifiedBy = "LYVO Reporting Engine";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. REPORT DATA WORKSHEET
  const sheetName = (reportMetadata.name || reportMetadata.reportType || "Report")
    .replace(/[\\/*?:[\]]/g, "_")
    .substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 5 }]
  });

  // Report Title & Disclaimers
  const titleRow = worksheet.addRow([`LYVO MANAGEMENT REPORT: ${(reportMetadata.name || reportMetadata.reportType || "FINANCIAL REPORT").toUpperCase()}`]);
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E293B" } };

  const disclaimerRow = worksheet.addRow(["Confidential — Internal Management Analytics Only. Not a statutory GST return or general ledger statement."]);
  disclaimerRow.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };

  const metaText = `Date Range: ${reportMetadata.dateRange?.start || "All Time"} to ${reportMetadata.dateRange?.end || "Current"} | Generated: ${new Date(reportMetadata.generatedAt || Date.now()).toISOString()} | Total Rows: ${results.length}`;
  const metaRow = worksheet.addRow([metaText]);
  metaRow.font = { name: "Arial", size: 9, bold: false, color: { argb: "FF475569" } };

  worksheet.addRow([]); // Blank separator row 4

  // Determine Columns from Rows
  let columns = [];
  if (results.length > 0) {
    const sample = results[0];
    columns = Object.keys(sample);
  } else if (reportMetadata.selectedColumns && reportMetadata.selectedColumns.length > 0) {
    columns = reportMetadata.selectedColumns;
  } else if (reportMetadata.metrics && reportMetadata.metrics.length > 0) {
    columns = [...(reportMetadata.dimensions || []), ...reportMetadata.metrics];
  } else {
    columns = ["message"];
  }

  // Add Table Headers (Row 5)
  const headerLabels = columns.map(formatHeaderLabel);
  const headerRow = worksheet.addRow(headerLabels);
  headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" } // Dark blue header fill
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 24;

  // Add Data Rows
  if (results.length === 0) {
    const emptyRow = worksheet.addRow(["No matching records found for the selected period/criteria."]);
    emptyRow.font = { name: "Arial", size: 10, italic: true };
  } else {
    results.forEach((item, index) => {
      const rowValues = columns.map(col => {
        const val = item[col];
        if (val === null || val === undefined) {
          // If cost/margin column and unknown, display UNKNOWN
          if (["grossProfit", "contributionProfit", "totalCogs", "grossMarginPercent", "contributionMarginPercent"].includes(col) && item.unknownCostUnits > 0) {
            return "UNKNOWN";
          }
          if (["gatewayFee", "freightCost"].includes(col) && item.paymentMethod !== "cod") {
            return "UNKNOWN";
          }
          return "-";
        }
        if (typeof val === "number") {
          return val;
        }
        if (val instanceof Date) {
          return val.toISOString().split("T")[0];
        }
        return sanitizeCellValue(val);
      });

      const row = worksheet.addRow(rowValues);
      row.font = { name: "Arial", size: 9 };
      row.alignment = { vertical: "middle" };

      // Zebra striping
      if (index % 2 === 1) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" }
        };
      }

      // Cell-level formatting
      columns.forEach((col, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        const rawVal = item[col];

        if (typeof rawVal === "number") {
          if (col.toLowerCase().includes("percent") || col.toLowerCase().includes("coverage")) {
            cell.numFmt = "0.00%";
            // If whole percent like 85.5%
            if (rawVal > 1) {
              cell.value = rawVal / 100;
            }
          } else if (["unitsSold", "orderCount", "unknownCostUnits", "quantity"].includes(col)) {
            cell.numFmt = "#,##0";
          } else {
            // Currency
            cell.numFmt = "₹#,##0.00;[Red]-₹#,##0.00;\"-\"";
          }
          cell.alignment = { horizontal: "right" };
        } else if (rawVal === "UNKNOWN" || cell.value === "UNKNOWN") {
          cell.font = { italic: true, color: { argb: "FFDC2626" }, bold: true };
          cell.alignment = { horizontal: "center" };
        } else if (cell.value === "-") {
          cell.alignment = { horizontal: "center" };
        }
      });
    });
  }

  // Adjust column widths safely
  worksheet.columns.forEach((col, idx) => {
    let maxLen = 12;
    if (headerLabels[idx]) {
      maxLen = Math.max(maxLen, headerLabels[idx].length + 4);
    }
    col.width = Math.min(Math.max(maxLen, 14), 45);
  });

  // Enable AutoFilter on Table Header
  if (columns.length > 0) {
    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + Math.max(1, results.length), column: columns.length }
    };
  }

  // 2. SUMMARY & PROVENANCE WORKSHEET
  const summarySheet = workbook.addWorksheet("Summary & Disclosures");
  const sTitle = summarySheet.addRow(["REPORT SUMMARY & PROVENANCE DISCLOSURES"]);
  sTitle.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF1E293B" } };
  summarySheet.addRow([]);

  if (summary && Object.keys(summary).length > 0) {
    const sHeader = summarySheet.addRow(["Metric", "Value"]);
    sHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    Object.entries(summary).forEach(([k, v]) => {
      const valDisplay = (v === null || v === undefined) ? "UNKNOWN" : (typeof v === "number" ? v : String(v));
      const sRow = summarySheet.addRow([formatHeaderLabel(k), valDisplay]);
      if (typeof v === "number") {
        sRow.getCell(2).numFmt = "₹#,##0.00";
      }
    });
    summarySheet.addRow([]);
  }

  if (disclosures && disclosures.length > 0) {
    const dHeader = summarySheet.addRow(["Data Provenance & Policy Disclosures"]);
    dHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    dHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };

    disclosures.forEach((disc, i) => {
      summarySheet.addRow([`${i + 1}. ${disc}`]);
    });
  }

  summarySheet.getColumn(1).width = 40;
  summarySheet.getColumn(2).width = 25;

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  generateXlsx,
  sanitizeCellValue,
  formatHeaderLabel
};
