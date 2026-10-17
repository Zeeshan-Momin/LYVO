const PDFDocument = require("pdfkit");
const { formatHeaderLabel } = require("./xlsxGenerator");

/**
 * Formats a value nicely for PDF text rendering
 */
function formatPdfCell(val, col, row = {}) {
  if (val === null || val === undefined) {
    if (["grossProfit", "contributionProfit", "totalCogs", "grossMarginPercent", "contributionMarginPercent"].includes(col) && row.unknownCostUnits > 0) {
      return "UNKNOWN";
    }
    if (["gatewayFee", "freightCost"].includes(col) && row.paymentMethod !== "cod") {
      return "UNKNOWN";
    }
    return "-";
  }
  if (typeof val === "number") {
    if (col.toLowerCase().includes("percent") || col.toLowerCase().includes("coverage")) {
      return `${val.toFixed(1)}%`;
    }
    if (["unitsSold", "orderCount", "unknownCostUnits", "quantity"].includes(col)) {
      return val.toLocaleString("en-IN");
    }
    return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  return String(val);
}

/**
 * Generates a PDF buffer from structured report results
 */
function generatePdf(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const { reportMetadata = {}, summary = {}, results = [], disclosures = [] } = reportData;

      // Determine columns to display
      let columns = [];
      if (results.length > 0) {
        columns = Object.keys(results[0]).slice(0, 10); // cap at 10 columns for PDF fit
      } else if (reportMetadata.selectedColumns && reportMetadata.selectedColumns.length > 0) {
        columns = reportMetadata.selectedColumns.slice(0, 10);
      } else if (reportMetadata.metrics && reportMetadata.metrics.length > 0) {
        columns = [...(reportMetadata.dimensions || []), ...reportMetadata.metrics].slice(0, 10);
      } else {
        columns = ["status"];
      }

      const isWide = columns.length > 5;
      const doc = new PDFDocument({
        size: "A4",
        layout: isWide ? "landscape" : "portrait",
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        bufferPages: true
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // 1. Header Banner
      doc.rect(36, 36, pageWidth, 42).fill("#1E3A8A");
      doc.fillColor("#FFFFFF")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`LYVO MANAGEMENT REPORT: ${(reportMetadata.name || reportMetadata.reportType || "FINANCE").toUpperCase()}`, 48, 44);

      doc.fontSize(8)
        .font("Helvetica")
        .text("Confidential — Internal Management Analytics Only (Not a Statutory GST Return)", 48, 62);

      doc.moveDown(2);

      // 2. Metadata Info Box
      const metaY = 88;
      doc.rect(36, metaY, pageWidth, 40).fill("#F1F5F9");
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica");

      const startDate = reportMetadata.dateRange?.start || "All Time";
      const endDate = reportMetadata.dateRange?.end || "Current";
      const genTime = new Date(reportMetadata.generatedAt || Date.now()).toISOString().replace("T", " ").substring(0, 19);

      doc.text(`Date Range: ${startDate} to ${endDate}`, 46, metaY + 8);
      doc.text(`Generated At: ${genTime}`, 46, metaY + 22);

      doc.text(`Report Type: ${reportMetadata.reportType || "Custom"}`, pageWidth / 2, metaY + 8);
      doc.text(`Total Records: ${results.length}`, pageWidth / 2, metaY + 22);

      doc.moveDown(2);

      // 3. Data Table
      let tableY = metaY + 50;
      const colWidth = pageWidth / columns.length;

      // Header Row
      doc.rect(36, tableY, pageWidth, 20).fill("#334155");
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");

      columns.forEach((col, i) => {
        const headerText = formatHeaderLabel(col);
        doc.text(headerText, 36 + (i * colWidth) + 4, tableY + 6, {
          width: colWidth - 8,
          align: ["grossMerchandiseSales", "netMerchandiseSales", "netRevenue", "totalCogs", "grossProfit", "contributionProfit", "gatewayFee", "freightCost", "refunds"].includes(col) ? "right" : "left",
          ellipsis: true
        });
      });

      tableY += 20;

      // Rows
      if (results.length === 0) {
        doc.rect(36, tableY, pageWidth, 20).fill("#FFFFFF");
        doc.fillColor("#64748B").fontSize(8).font("Helvetica-Oblique")
          .text("No records found for the specified period and filter criteria.", 46, tableY + 6);
        tableY += 20;
      } else {
        results.forEach((row, rowIndex) => {
          // Page overflow check
          if (tableY > doc.page.height - 60) {
            doc.addPage({ layout: isWide ? "landscape" : "portrait", margins: { top: 36, bottom: 36, left: 36, right: 36 } });
            tableY = 40;

            // Repeat Table Header
            doc.rect(36, tableY, pageWidth, 20).fill("#334155");
            doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold");
            columns.forEach((col, i) => {
              doc.text(formatHeaderLabel(col), 36 + (i * colWidth) + 4, tableY + 6, {
                width: colWidth - 8,
                align: "left",
                ellipsis: true
              });
            });
            tableY += 20;
          }

          const rowBg = rowIndex % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
          doc.rect(36, tableY, pageWidth, 18).fill(rowBg);

          columns.forEach((col, i) => {
            const val = row[col];
            const text = formatPdfCell(val, col, row);
            const isUnknown = text === "UNKNOWN";
            const isNumeric = typeof val === "number";

            doc.fillColor(isUnknown ? "#DC2626" : "#1E293B")
              .fontSize(7)
              .font(isUnknown ? "Helvetica-Bold" : "Helvetica")
              .text(text, 36 + (i * colWidth) + 4, tableY + 5, {
                width: colWidth - 8,
                align: isNumeric ? "right" : "left",
                ellipsis: true
              });
          });

          tableY += 18;
        });
      }

      // 4. Disclosures & Provenance Box
      if (disclosures.length > 0 && tableY < doc.page.height - 70) {
        tableY += 10;
        doc.rect(36, tableY, pageWidth, 15 + (disclosures.length * 10)).fill("#F1F5F9");
        doc.fillColor("#334155").fontSize(7).font("Helvetica-Bold")
          .text("Management Disclosures & Provenance:", 42, tableY + 4);

        disclosures.forEach((disc, i) => {
          doc.fillColor("#475569").fontSize(6.5).font("Helvetica")
            .text(`• ${disc}`, 46, tableY + 14 + (i * 9), { width: pageWidth - 20 });
        });
      }

      // 5. Add Page Numbers
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor("#94A3B8").fontSize(7).font("Helvetica")
          .text(`Page ${i + 1} of ${range.count} | Generated for LYVO Admin Management`, 36, doc.page.height - 24, {
            align: "center",
            width: pageWidth
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePdf,
  formatPdfCell
};
