const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const ExportLog = require("../models/ExportLog");
const reportExecutionService = require("./reportExecutionService");
const { generateXlsx } = require("./xlsxGenerator");
const { generatePdf } = require("./pdfGenerator");

const EXPORT_DIR = path.resolve(__dirname, "../uploads/exports");

// Maximum allowed record limits
const MAX_LIMIT_XLSX = 5000;
const MAX_LIMIT_PDF = 500;

// Ensure exports directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * Sanitizes a string to be safely used in filenames
 */
function sanitizeFileNamePart(str) {
  if (!str) return "report";
  return String(str)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 50);
}

/**
 * Orchestrates Report Execution -> XLSX / PDF Generation -> ExportLog Audit
 */
async function exportReport({
  reportDefinition = {},
  savedReportId = null,
  runtimeOverrides = {},
  format = "xlsx",
  user
}) {
  const normFormat = String(format).toLowerCase().trim();
  if (!["xlsx", "pdf"].includes(normFormat)) {
    const err = new Error(`Unsupported export format '${format}'. Allowed formats: xlsx, pdf`);
    err.statusCode = 400;
    throw err;
  }

  const maxLimit = normFormat === "pdf" ? MAX_LIMIT_PDF : MAX_LIMIT_XLSX;
  const requestedLimit = parseInt(reportDefinition.limit || runtimeOverrides.limit, 10);
  if (requestedLimit && requestedLimit > maxLimit) {
    const err = new Error(
      `Requested export row limit (${requestedLimit}) exceeds the maximum allowed limit for ${normFormat.toUpperCase()} (${maxLimit} rows). Please narrow your date range or filter criteria.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Generate unique Export ID
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const exportId = `exp_${timestamp}_${randomSuffix}`;

  const reportType = reportDefinition.reportType || "custom";
  const reportName = reportDefinition.name || `${reportType.replace(/_/g, " ").toUpperCase()} Report`;

  // Create Pending ExportLog entry
  let exportLog = await ExportLog.create({
    exportId,
    reportName,
    reportType,
    format: normFormat,
    filters: reportDefinition.filters || runtimeOverrides.filters || {},
    recordCount: 0,
    status: "pending",
    generatedBy: user?._id
  });

  try {
    // 1. Execute Report via Phase 3D-2 Report Execution Engine
    let reportResult;
    if (savedReportId) {
      reportResult = await reportExecutionService.executeSavedReport(savedReportId, user, {
        ...runtimeOverrides,
        limit: requestedLimit || maxLimit
      });
    } else {
      reportResult = await reportExecutionService.executeReport(
        {
          ...reportDefinition,
          limit: requestedLimit || maxLimit
        },
        user
      );
    }

    const rowCount = reportResult.results?.length || 0;
    if (rowCount > maxLimit) {
      const err = new Error(
        `Generated report contains ${rowCount} rows, exceeding the ${normFormat.toUpperCase()} limit of ${maxLimit} rows. Please filter your request.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Generate Binary File Buffer
    let buffer;
    if (normFormat === "xlsx") {
      buffer = await generateXlsx(reportResult);
    } else {
      buffer = await generatePdf(reportResult);
    }

    // 3. Write File Safely to Server Disk
    const safeReportName = sanitizeFileNamePart(reportResult.reportMetadata?.name || reportType);
    const startDate = sanitizeFileNamePart(reportResult.reportMetadata?.dateRange?.start || "start");
    const endDate = sanitizeFileNamePart(reportResult.reportMetadata?.dateRange?.end || "end");
    const fileName = `LYVO_${safeReportName}_${startDate}_to_${endDate}_${exportId}.${normFormat}`;
    const filePath = path.join(EXPORT_DIR, fileName);

    fs.writeFileSync(filePath, buffer);
    const fileSize = buffer.length;

    // 4. Update ExportLog with Success Status
    exportLog.status = "completed";
    exportLog.recordCount = rowCount;
    exportLog.fileSize = fileSize;
    exportLog.fileName = fileName;
    exportLog.filePath = filePath;
    exportLog.reportName = reportResult.reportMetadata?.name || reportName;
    exportLog.reportType = reportResult.reportMetadata?.reportType || reportType;
    await exportLog.save();

    return {
      success: true,
      exportId,
      fileName,
      format: normFormat,
      recordCount: rowCount,
      fileSize,
      downloadUrl: `/api/admin/finance/reports/exports/download/${exportId}`,
      reportMetadata: reportResult.reportMetadata
    };
  } catch (err) {
    // Audit failed export
    exportLog.status = "failed";
    exportLog.errorMessage = err.message || "Export generation failed";
    await exportLog.save();
    throw err;
  }
}

/**
 * Resolves a safe file download stream for an exported report
 */
async function getExportFileForDownload(exportIdentifier, user) {
  if (!exportIdentifier) {
    const err = new Error("Missing export identifier");
    err.statusCode = 400;
    throw err;
  }

  // Find ExportLog by exportId or ObjectId
  let query = { exportId: exportIdentifier };
  if (mongoose.Types.ObjectId.isValid(exportIdentifier)) {
    query = { $or: [{ exportId: exportIdentifier }, { _id: exportIdentifier }] };
  }

  const exportLog = await ExportLog.findOne(query).lean();
  if (!exportLog) {
    const err = new Error("Export record not found");
    err.statusCode = 404;
    throw err;
  }

  if (exportLog.status !== "completed") {
    const err = new Error(`Export is not ready for download (current status: ${exportLog.status})`);
    err.statusCode = 400;
    throw err;
  }

  // Security check: Path Traversal Protection
  const targetFilePath = exportLog.filePath || path.join(EXPORT_DIR, exportLog.fileName);
  const resolvedPath = path.resolve(targetFilePath);

  if (!resolvedPath.startsWith(EXPORT_DIR) || resolvedPath.includes("..")) {
    const err = new Error("Invalid or unsafe export file path");
    err.statusCode = 403;
    throw err;
  }

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error("Export file no longer exists on server");
    err.statusCode = 404;
    throw err;
  }

  const mimeType = exportLog.format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf";

  return {
    filePath: resolvedPath,
    fileName: exportLog.fileName || path.basename(resolvedPath),
    mimeType,
    fileSize: exportLog.fileSize
  };
}

module.exports = {
  exportReport,
  getExportFileForDownload,
  MAX_LIMIT_XLSX,
  MAX_LIMIT_PDF,
  EXPORT_DIR
};
