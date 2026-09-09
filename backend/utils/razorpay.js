const Razorpay = require("razorpay");

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const isDummyKey = !keyId || keyId.includes("xxxx") || keyId.includes("mock") || keyId === "rzp_test_xxxxxxxxxxxxxxxx" ||
                   !keySecret || keySecret.includes("xxxx") || keySecret.includes("mock") || keySecret === "rzp_secret_xxxxxxxxxxxxxxxx";

let razorpay;

if (isDummyKey) {
  razorpay = {
    orders: {
      create: async (data) => {
        const amount = data.amount || 10000;
        const id = `order_mock_${Math.random().toString(36).substr(2, 9)}`;
        return {
          id,
          entity: "order",
          amount: amount,
          amount_paid: 0,
          amount_due: amount,
          currency: data.currency || "INR",
          receipt: data.receipt,
          status: "created",
          attempts: 0,
          notes: data.notes || {},
          created_at: Math.floor(Date.now() / 1000)
        };
      }
    },
    payments: {
      refund: async (paymentId, data) => {
        return {
          id: `rfnd_mock_${Math.random().toString(36).substr(2, 9)}`,
          entity: "refund",
          amount: data?.amount || 10000,
          currency: "INR",
          payment_id: paymentId,
          status: "processed",
          created_at: Math.floor(Date.now() / 1000)
        };
      }
    }
  };
} else {
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

module.exports = razorpay;
