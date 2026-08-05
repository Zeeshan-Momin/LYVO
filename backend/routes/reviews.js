const r=require("express").Router(),c=require("../controllers/reviewController"),{protect}=require("../middleware/auth");
r.get("/:productId",c.getProductReviews);r.post("/:productId",protect,c.createReview);
r.put("/:id/edit",protect,c.updateReview);r.delete("/:id",protect,c.deleteReview);r.patch("/:id/helpful",protect,c.markHelpful);
module.exports=r;
