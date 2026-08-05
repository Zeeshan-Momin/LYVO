import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiCheck, FiSearch, FiPackage, FiTruck, FiRefreshCw, FiArrowRight, FiInfo } from "react-icons/fi"
import toast from "react-hot-toast"
import axios from "axios"

const SECTIONS = {
  // Support
  "size-guide": {
    title: "Size Guide",
    category: "Support",
    description: "Find your perfect fit. LYVO sneakers run true to standard UK sizes."
  },
  "shipping": {
    title: "Shipping & Delivery",
    category: "Support",
    description: "Domestic and international shipping rates, courier partners, and timelines."
  },
  "returns": {
    title: "Returns & Exchange",
    category: "Support",
    description: "Our 30-day hassle-free returns and replacement policy details."
  },
  "track-order": {
    title: "Track Order",
    category: "Support",
    description: "Check the current delivery status and routing history of your order."
  },
  // Company
  "about": {
    title: "About LYVO",
    category: "Company",
    description: "Learn more about LYVO's values, team, and footwear innovation."
  },
  "our-story": {
    title: "Our Story",
    category: "Company",
    description: "The journey from a vision to premium sneaker craftmanship."
  },
  "careers": {
    title: "Careers",
    category: "Company",
    description: "Join the hustle. Work with us to design the future of footwear."
  },
  // Legal
  "privacy": {
    title: "Privacy Policy",
    category: "Legal",
    description: "How we collect, store, and protect your personal data."
  },
  "terms": {
    title: "Terms & Conditions",
    category: "Legal",
    description: "Rules, regulations, and terms of service for shopping on LYVO."
  },
  "cookies": {
    title: "Cookie Policy",
    category: "Legal",
    description: "How we use web storage to personalize and optimize your browsing."
  }
}

export default function InfoPage() {
  const { section } = useParams()
  const navigate = useNavigate()
  const activeSection = SECTIONS[section] ? section : "about"

  // Order tracking states
  const [trackNum, setTrackNum] = useState("")
  const [orderData, setOrderData] = useState(null)
  const [trackingLoading, setTrackingLoading] = useState(false)

  // Careers form state
  const [careerForm, setCareerForm] = useState({ name: "", email: "", role: "Footwear Designer", note: "" })
  const [careerSubmitting, setCareerSubmitting] = useState(false)

  useEffect(() => {
    // Reset states on section switch
    setOrderData(null)
    setTrackNum("")
  }, [section])

  const handleTrack = async (e) => {
    e.preventDefault()
    if (!trackNum.trim()) return
    setTrackingLoading(true)
    setOrderData(null)
    try {
      const { data } = await axios.get(`/api/orders/track/${trackNum.trim().toUpperCase()}`)
      setOrderData(data.order)
    } catch (err) {
      toast.error(err.response?.data?.message || "Order not found. Check your order number.")
    } finally {
      setTrackingLoading(false)
    }
  }

  const handleApply = async (e) => {
    e.preventDefault()
    if (!careerForm.name.trim() || !careerForm.email.trim()) {
      toast.error("Please fill name and email fields")
      return
    }
    setCareerSubmitting(true)
    await new Promise(r => setTimeout(r, 1200))
    toast.success("Application submitted successfully! 🚀")
    setCareerForm({ name: "", email: "", role: "Footwear Designer", note: "" })
    setCareerSubmitting(false)
  }

  const renderContent = () => {
    switch (activeSection) {
      case "size-guide":
        return (
          <div className="space-y-6">
            <p className="text-white/60 leading-relaxed">
              We recommend ordering your standard UK shoe size. If you are between sizes, we suggest choosing the larger size for a more comfortable fit.
            </p>
            <div className="border border-white/8 rounded-2xl overflow-hidden bg-dark-800">
              <div className="p-4 border-b border-white/8 font-semibold bg-white/2 text-sm">Men's & Unisex Size Chart</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.01] text-white/40 text-xs uppercase font-medium">
                      <th className="px-6 py-3">UK Size</th>
                      <th className="px-6 py-3">US Size</th>
                      <th className="px-6 py-3">EU Size</th>
                      <th className="px-6 py-3">Foot Length (cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/70">
                    {[
                      ["UK 6", "US 7", "EU 40", "24.5 cm"],
                      ["UK 7", "US 8", "EU 41", "25.4 cm"],
                      ["UK 8", "US 9", "EU 42", "26.2 cm"],
                      ["UK 9", "US 10", "EU 43", "27.1 cm"],
                      ["UK 10", "US 11", "EU 44", "27.9 cm"],
                      ["UK 11", "US 12", "EU 45", "28.8 cm"],
                      ["UK 12", "US 13", "EU 46", "29.6 cm"],
                    ].map(([uk, us, eu, cm]) => (
                      <tr key={uk} className="hover:bg-white/2 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-acid">{uk}</td>
                        <td className="px-6 py-3.5">{us}</td>
                        <td className="px-6 py-3.5">{eu}</td>
                        <td className="px-6 py-3.5">{cm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )

      case "shipping":
        return (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 border border-white/8 bg-dark-800 rounded-2xl">
                <div className="w-10 h-10 bg-acid/15 text-acid rounded-xl flex items-center justify-center mb-3"><FiTruck size={20} /></div>
                <h4 className="font-semibold text-base mb-1.5">Free Shipping</h4>
                <p className="text-xs text-white/50 leading-relaxed">Available on all domestic orders across India over <span className="text-white font-medium">₹999</span>. Flat fee of ₹99 applies below that.</p>
              </div>
              <div className="p-5 border border-white/8 bg-dark-800 rounded-2xl">
                <div className="w-10 h-10 bg-acid/15 text-acid rounded-xl flex items-center justify-center mb-3"><FiPackage size={20} /></div>
                <h4 className="font-semibold text-base mb-1.5">Delivery Timelines</h4>
                <p className="text-xs text-white/50 leading-relaxed">Metro cities take <span className="text-white font-medium">2–4 business days</span>. Rest of India deliveries complete in 3–5 business days.</p>
              </div>
            </div>
            <div className="p-5 border border-white/8 bg-dark-800 rounded-2xl">
              <h4 className="font-semibold text-sm tracking-wider uppercase mb-3">Our Delivery Partners</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                We partner with India's leading express logistics networks, including Bluedart, Delhivery, DTDC, and Amazon Shipping, to ensure safe and trackable premium handling of your kicks.
              </p>
            </div>
          </div>
        )

      case "returns":
        return (
          <div className="space-y-6">
            <p className="text-white/60 leading-relaxed">
              We stand by our product quality and fit. That's why we offer a 30-day exchange and returns window. Keep the product unworn and in original box packaging.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {["1. Initiate", "2. Pickup", "3. Refund / Exchange"].map((step, i) => (
                <div key={i} className="p-4 bg-white/2 border border-white/5 rounded-xl text-center">
                  <p className="text-xs text-acid font-bold mb-1.5">{step}</p>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    {i === 0 ? "Go to your Profile -> Orders page, click Return on delivered items." :
                      i === 1 ? "We arrange a free pickup from your address within 24–48 hours." :
                        "Once verified in our facility, we issue replacement or direct bank refunds."}
                  </p>
                </div>
              ))}
            </div>
            <div className="text-center pt-4">
              <Link to="/orders" className="btn-primary inline-flex items-center gap-2 text-sm py-3 px-6">View My Orders <FiArrowRight size={16} /></Link>
            </div>
          </div>
        )

      case "track-order":
        return (
          <div className="space-y-6">
            <p className="text-white/60 leading-relaxed">
              Enter your Order Number (e.g. <span className="font-mono text-acid">LYVO-XXXXXX</span>) from your invoice or SMS to query live status.
            </p>
            <form onSubmit={handleTrack} className="flex gap-2">
              <input
                type="text"
                required
                value={trackNum}
                onChange={e => setTrackNum(e.target.value)}
                placeholder="LYVO-100204"
                className="input flex-1 py-3 text-sm font-mono tracking-widest uppercase"
              />
              <button
                type="submit"
                disabled={trackingLoading || !trackNum.trim()}
                className="btn-primary px-6 py-3 flex items-center justify-center shrink-0"
              >
                {trackingLoading ? <div className="w-5 h-5 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" /> : <FiSearch size={18} />}
              </button>
            </form>
            <AnimatePresence mode="wait">
              {orderData && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-5 border border-acid/20 bg-acid/5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-2 border-b border-white/5 pb-3">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Order Number</p>
                      <p className="font-mono text-sm text-acid font-semibold">#{orderData.orderNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Current Status</p>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-acid text-dark-900 capitalize mt-0.5">{orderData.status}</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-white/40">Placed On:</span><span>{new Date(orderData.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Payment:</span><span className="capitalize">{orderData.isPaid ? "Paid ✓" : "Cash on Delivery"}</span></div>
                    {orderData.trackingNumber && (
                      <div className="flex justify-between"><span className="text-white/40">Tracking Details:</span><span className="font-semibold text-acid font-mono">{orderData.trackingNumber}</span></div>
                    )}
                  </div>
                  <div className="border-t border-white/5 pt-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Order Items</p>
                    <div className="space-y-2">
                      {orderData.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-white/70">
                          <span>{item.product?.name || item.name} (Size: {item.size})</span>
                          <span>Qty: {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )

      case "about":
        return (
          <div className="space-y-6 text-white/70 leading-relaxed text-sm">
            <p>
              LYVO (Live Your Vision Out) is a contemporary footwear brand dedicated to progressive aesthetics, functional craftsmanship, and high-street lifestyle expression.
            </p>
            <p>
              Founded in 2026, we believe that luxury design should be accessible, durable, and represent the wearer's daily grind. Every component, from high-density comfort midsoles to vulcanized custom grip treads, is built to support your forward movement.
            </p>
            <blockquote className="border-l-2 border-acid pl-4 italic text-white/60 text-base">
              "We don't just sell footwear; we package the mindset of hustle, focus, and vision."
            </blockquote>
          </div>
        )

      case "our-story":
        return (
          <div className="space-y-6 text-white/70 leading-relaxed text-sm">
            <p>
              LYVO began in a small design workshop where two footwear designers set out to break the cycle of overpriced premium shoes. We wanted to build a brand that spoke to street culture, tech founders, and visual designers.
            </p>
            <p>
              Over the last few years, we have scaled our production to work with environment-conscious materials, lightweight mesh weaves, and customized high-rebound cushioning. We continue to design in-house and partner directly with ethical manufacturing hubs.
            </p>
          </div>
        )

      case "careers":
        return (
          <div className="space-y-6">
            <p className="text-white/60 leading-relaxed text-sm">
              We are constantly seeking designers, engineers, and brand strategists to join our team in Mumbai. If you're passionate about sneakers and streetwear, we'd love to hear from you.
            </p>
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wider">Open Positions</h4>
              {[
                ["Footwear Designer", "Design team · In-office (Mumbai)"],
                ["React Frontend Engineer", "Technology team · Remote / Hybrid"],
                ["Brand Lead", "Marketing team · In-office (Mumbai)"]
              ].map(([role, dept]) => (
                <div key={role} className="p-4 border border-white/5 bg-dark-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-sm">{role}</h5>
                    <p className="text-xs text-white/40 mt-0.5">{dept}</p>
                  </div>
                  <button onClick={() => setCareerForm(p => ({ ...p, role }))} className="text-xs text-acid border border-acid/20 px-3 py-1.5 rounded-lg hover:bg-acid/10 transition-colors">Apply</button>
                </div>
              ))}
            </div>
            <form onSubmit={handleApply} className="card p-5 space-y-4 border border-white/8 bg-dark-800">
              <h4 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-1.5"><FiInfo size={14} className="text-acid" /> Application Portal</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={careerForm.name}
                    onChange={e => setCareerForm(p => ({ ...p, name: e.target.value }))}
                    className="input py-2.5 text-xs"
                    placeholder="Jordan Miles"
                  />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    required
                    value={careerForm.email}
                    onChange={e => setCareerForm(p => ({ ...p, email: e.target.value }))}
                    className="input py-2.5 text-xs"
                    placeholder="jordan@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="label">Selected Role</label>
                <select
                  value={careerForm.role}
                  onChange={e => setCareerForm(p => ({ ...p, role: e.target.value }))}
                  className="input py-2.5 text-xs"
                >
                  <option value="Footwear Designer">Footwear Designer</option>
                  <option value="React Frontend Engineer">React Frontend Engineer</option>
                  <option value="Brand Lead">Brand Lead</option>
                </select>
              </div>
              <div>
                <label className="label">Cover Note / Resume Link</label>
                <textarea
                  value={careerForm.note}
                  onChange={e => setCareerForm(p => ({ ...p, note: e.target.value }))}
                  rows={3}
                  className="input py-2.5 text-xs resize-none"
                  placeholder="Tell us about yourself or link your portfolio..."
                />
              </div>
              <button
                type="submit"
                disabled={careerSubmitting}
                className="btn-primary w-full py-3 text-xs"
              >
                {careerSubmitting ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          </div>
        )

      default: // policy, terms, cookies
        return (
          <div className="space-y-4 text-white/70 leading-relaxed text-sm">
            <h4 className="font-semibold text-white">1. Information Collection</h4>
            <p>
              We collect information you provide directly to us (e.g. when you check out or create an account) and automatically via standard cookies (e.g. preferred theme, active cart sessions).
            </p>
            <h4 className="font-semibold text-white">2. Data Security & Third Parties</h4>
            <p>
              Your data is processed in secure servers. Payments are handled via SSL-encrypted payment processors. We do not sell or lease user information to advertising networks.
            </p>
            <h4 className="font-semibold text-white">3. Users Rights</h4>
            <p>
              You can contact our support team at any time to request data deletions, profile edits, or withdraw cookies permission.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Left Navigation Sidebar */}
          <aside className="space-y-6 lg:col-span-1">
            {[
              {
                title: "Support",
                links: [
                  ["size-guide", "Size Guide"],
                  ["shipping", "Shipping & Delivery"],
                  ["returns", "Returns & Exchanges"],
                  ["track-order", "Track Order"]
                ]
              },
              {
                title: "Company",
                links: [
                  ["about", "About LYVO"],
                  ["our-story", "Our Story"],
                  ["careers", "Careers"]
                ]
              },
              {
                title: "Legal",
                links: [
                  ["privacy", "Privacy Policy"],
                  ["terms", "Terms of Service"],
                  ["cookies", "Cookie Policy"]
                ]
              }
            ].map(grp => (
              <div key={grp.title} className="space-y-2">
                <h4 className="text-[10px] tracking-widest text-white/30 uppercase font-bold pl-3">{grp.title}</h4>
                <div className="flex flex-col gap-1">
                  {grp.links.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => navigate(`/info/${id}`)}
                      className={`text-left text-sm py-2 px-3.5 rounded-xl transition-all font-medium ${activeSection === id
                        ? "bg-acid/10 border border-acid/15 text-acid"
                        : "border border-transparent text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {/* Right Content Section */}
          <main className="lg:col-span-3 card p-6 md:p-8 space-y-6 h-fit bg-dark-700">
            <div>
              <p className="tag-line mb-3 capitalize text-xs">{SECTIONS[activeSection]?.category || "Info"}</p>
              <h2 className="font-display text-4xl tracking-wider uppercase mb-2">{SECTIONS[activeSection]?.title || activeSection.replace("-", " ")}</h2>
              <p className="text-white/40 text-xs">{activeSection === "privacy" || activeSection === "terms" || activeSection === "cookies" ? "Last updated: July 2026" : SECTIONS[activeSection]?.description}</p>
            </div>
            <div className="border-t border-white/5 pt-6">{renderContent()}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
