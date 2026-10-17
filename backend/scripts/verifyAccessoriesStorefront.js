const http = require("http");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on("error", reject);
  });
}

async function verify() {
  console.log("=== 1. Verifying Belts Category API ===");
  const beltsRes = await fetchJson("http://localhost:5000/api/products?category=belts");
  console.log("Belts API Status:", beltsRes.status);
  console.log("Belts Count:", beltsRes.data?.data?.products?.length || beltsRes.data?.products?.length || 0);
  const belts = beltsRes.data?.data?.products || beltsRes.data?.products || [];
  belts.forEach(p => {
    console.log(`- Belt: "${p.name}", Price: ₹${p.price}, Discount: ₹${p.discountPrice}, Sizes:`, p.sizes.map(s => `${s.size}:${s.stock}`).join(", "));
  });

  console.log("\n=== 2. Verifying Socks Category API ===");
  const socksRes = await fetchJson("http://localhost:5000/api/products?category=socks");
  console.log("Socks API Status:", socksRes.status);
  console.log("Socks Count:", socksRes.data?.data?.products || socksRes.data?.products?.length || 0);
  const socks = socksRes.data?.data?.products || socksRes.data?.products || [];
  socks.forEach(p => {
    console.log(`- Sock: "${p.name}", Price: ₹${p.price}, Discount: ₹${p.discountPrice}, Sizes:`, p.sizes.map(s => `${s.size}:${s.stock}`).join(", "));
  });

  if (belts.length > 0) {
    console.log("\n=== 3. Verifying Belt Product Detail API ===");
    const beltDetail = await fetchJson(`http://localhost:5000/api/products/${belts[0]._id}`);
    console.log("Belt Detail API Status:", beltDetail.status);
    console.log("Product Name:", beltDetail.data?.product?.name || beltDetail.data?.name);
    console.log("Image URL:", beltDetail.data?.product?.images?.[0]?.url || beltDetail.data?.images?.[0]?.url);
  }

  if (socks.length > 0) {
    console.log("\n=== 4. Verifying Sock Product Detail API ===");
    const sockDetail = await fetchJson(`http://localhost:5000/api/products/${socks[0]._id}`);
    console.log("Sock Detail API Status:", sockDetail.status);
    console.log("Product Name:", sockDetail.data?.product?.name || sockDetail.data?.name);
    console.log("Image URL:", sockDetail.data?.product?.images?.[0]?.url || sockDetail.data?.images?.[0]?.url);
  }

  console.log("\n=== 5. Verifying Categories API ===");
  const catsRes = await fetchJson("http://localhost:5000/api/categories");
  console.log("Categories Status:", catsRes.status);
  console.log("Categories:", (catsRes.data?.categories || catsRes.data || []).map(c => c.name));
}

verify().catch(console.error);
