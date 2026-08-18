const r=require("express").Router(),c=require("../controllers/authController"),{protect}=require("../middleware/auth");
r.post("/register",c.register);r.post("/login",c.login);r.post("/refresh",c.refreshToken);r.post("/google",c.googleLogin);
r.post("/logout",protect,c.logout);r.post("/logout-all",protect,c.logoutAll);r.get("/me",protect,c.getMe);
r.post("/forgot-password",c.forgotPassword);r.post("/reset-password/:token",c.resetPassword);
r.post("/send-verification",protect,c.sendEmailVerification);r.post("/verify-email/:token",c.verifyEmail);
r.put("/profile",protect,c.updateProfile);r.put("/change-password",protect,c.changePassword);
r.post("/address",protect,c.addAddress);r.delete("/address/:id",protect,c.deleteAddress);
r.post("/wishlist/:productId",protect,c.toggleWishlist);
module.exports=r;
