const mongoose = require("mongoose");
const siteStatsSchema = new mongoose.Schema({
  key:{ type:String, unique:true, default:"global" },
  totalVisits:{ type:Number, default:0 },
}, { timestamps:true });
siteStatsSchema.statics.incrementVisit = function() {
  return this.findOneAndUpdate({ key:"global" }, { $inc:{ totalVisits:1 } }, { new:true, upsert:true });
};
module.exports = mongoose.model("SiteStats", siteStatsSchema);
