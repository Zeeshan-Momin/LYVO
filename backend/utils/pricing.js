const Product = require("./../models/Product");
const { Coupon } = require("./../models/models");

// Recomputes pricing server-side from item ids — never trust client-sent totals.
// Returns validItems (with server-verified price/name/image) plus the coupon
// object if one was applied, so callers can run stock checks / usage tracking.
async function computePricing(items, couponCode) {
  let subtotal = 0;
  const validItems = [];
  for (const item of items) {
    const p = await Product.findById(item.product);
    if (!p || !p.isActive) throw Object.assign(new Error(`${item.name || "Item"} unavailable`), { statusCode: 400 });
    const se = p.sizes.find((s) => s.size === item.size);
    if (!se || se.stock < item.quantity)
      throw Object.assign(new Error(`Insufficient stock: ${p.name} size ${item.size}`), { statusCode: 400 });
    const price = p.discountPrice || p.price;
    subtotal += price * item.quantity;
    validItems.push({ product: p._id, name: p.name, image: p.images[0]?.url || "", price, size: item.size, color: item.color || "", quantity: item.quantity });
  }

  const shippingCost = subtotal >= 999 ? 0 : 99;
  const tax = Math.round(subtotal * 0.18);
  let couponDiscount = 0, validCoupon = null;
  if (couponCode) {
    validCoupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
    if (validCoupon) {
      if (new Date() > validCoupon.expiryDate) throw Object.assign(new Error("Coupon expired"), { statusCode: 400 });
      if (subtotal < validCoupon.minPurchase) throw Object.assign(new Error(`Min purchase ₹${validCoupon.minPurchase} required`), { statusCode: 400 });
      couponDiscount = validCoupon.type === "percentage"
        ? Math.min(Math.round((subtotal * validCoupon.value) / 100), validCoupon.maxDiscount || Infinity)
        : validCoupon.value;
    }
  }

  const total = subtotal + shippingCost + tax - couponDiscount;
  return { subtotal, shippingCost, tax, couponDiscount, total, validItems, validCoupon };
}

module.exports = { computePricing };
