const router = require("express").Router();
const taxCtrl = require("../controllers/taxController");
const { protect, adminOnly } = require("../middleware/auth");

const guard = [protect, adminOnly];

// Phase 3C-1: Tax & GST Management Analytics Core
router.get("/overview", ...guard, taxCtrl.getTaxOverview);
router.get("/hsn", ...guard, taxCtrl.getHsnAnalytics);
router.get("/states", ...guard, taxCtrl.getStateAnalytics);
router.get("/rates", ...guard, taxCtrl.getRateAnalytics);
router.get("/input-tax", ...guard, taxCtrl.getInputTaxAnalytics);

// Phase 3C-2: Tax Data Quality & Reconciliation
router.get("/data-quality", ...guard, taxCtrl.getTaxDataQuality);
router.get("/reconciliation", ...guard, taxCtrl.getTaxReconciliation);

module.exports = router;
