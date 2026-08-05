const r=require("express").Router(),c=require("../controllers/authController"),{protect}=require("../middleware/auth");
r.post("/register",c.register);r.post("/login",c.login);r.post("/refresh",c.refreshToken);
r.post("/logout",protect,c.logout);r.get("/me",protect,c.getMe);
r.put("/profile",protect,c.updateProfile);r.put("/change-password",protect,c.changePassword);
r.post("/address",protect,c.addAddress);r.delete("/address/:id",protect,c.deleteAddress);
r.post("/wishlist/:productId",protect,c.toggleWishlist);
module.exports=r;
