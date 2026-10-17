const taxService = require("../services/taxService");
const logger = require("../utils/logger");

/**
 * GET /api/admin/tax/overview
 * Output tax, sales base, rate/state distributions, and refund impact
 */
async function getTaxOverview(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getTaxOverview({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getTaxOverview controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

/**
 * GET /api/admin/tax/hsn
 * Line-item HSN aggregation with units, taxable values, and component taxes
 */
async function getHsnAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getHsnAnalytics({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getHsnAnalytics controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

/**
 * GET /api/admin/tax/states
 * State / Place of Supply distribution and inter vs intrastate breakdowns
 */
async function getStateAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getStateAnalytics({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getStateAnalytics controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

/**
 * GET /api/admin/tax/rates
 * Rate distribution from line-item snapshots
 */
async function getRateAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getRateAnalytics({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getRateAnalytics controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

/**
 * GET /api/admin/tax/input-tax
 * Input GST and ITC tracking from Expense records
 */
async function getInputTaxAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getInputTaxAnalytics({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getInputTaxAnalytics controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

/**
 * GET /api/admin/tax/data-quality
 * Tax Data Quality anomaly audit engine
 */
async function getTaxDataQuality(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getTaxDataQuality({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getTaxDataQuality controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

/**
 * GET /api/admin/tax/reconciliation
 * Management Tax Reconciliation summary
 */
async function getTaxReconciliation(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await taxService.getTaxReconciliation({ startDate, endDate });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error("Error in getTaxReconciliation controller", { error: error.message, stack: error.stack });
    return next(error);
  }
}

module.exports = {
  getTaxOverview,
  getHsnAnalytics,
  getStateAnalytics,
  getRateAnalytics,
  getInputTaxAnalytics,
  getTaxDataQuality,
  getTaxReconciliation
};
