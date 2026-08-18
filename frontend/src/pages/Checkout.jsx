import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiCheck, FiMapPin, FiCreditCard, FiPackage, FiArrowRight, FiArrowLeft } from "react-icons/fi"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { orderAPI, paymentAPI, authAPI } from "../api"
import toast from "react-hot-toast"
import axios from "axios"

const STEPS = ["Address","Payment","Review"]
const PAY_METHODS = [{id:"card",label:"Credit / Debit Card",icon:"💳"},{id:"upi",label:"UPI",icon:"📱"},{id:"netbanking",label:"Net Banking",icon:"🏦"},{id:"cod",label:"Cash on Delivery",icon:"💵"}]
const EMPTY_ADDR = {fullName:"",phone:"",email:"",houseNo:"",street:"",landmark:"",zipCode:"",city:"",state:"",country:"India",addressType:"Home",saveAddress:false}
const isDummyRazorpay = !import.meta.env.VITE_RAZORPAY_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID.includes("xxxx") || import.meta.env.VITE_RAZORPAY_KEY_ID.includes("test");

const POPULAR_BANKS = [
  { id: "sbi", name: "SBI" },
  { id: "hdfc", name: "HDFC" },
  { id: "icici", name: "ICICI" },
  { id: "axis", name: "Axis Bank" },
  { id: "kotak", name: "Kotak Bank" }
]
const OTHER_BANKS = [
  "Bank of Baroda",
  "Punjab National Bank",
  "Canara Bank",
  "Union Bank of India",
  "IDBI Bank",
  "IndusInd Bank",
  "Yes Bank",
  "Federal Bank"
]

function Checkout() {
  const { items, subtotal, shippingCost, tax, total, clearCart, couponCode, couponDiscount } = useCart()
  const { user, fetchMe } = useAuth(), navigate = useNavigate()

  const [cardNumberInput, setCardNumberInput] = useState("")
  const [cardExpiryInput, setCardExpiryInput] = useState("")
  const [cardCvcInput, setCardCvcInput] = useState("")

  const handleMockCardNumber = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 16)
    const formatted = clean.match(/.{1,4}/g)?.join(" ") || clean
    setCardNumberInput(formatted)
    setCardNumberComplete(clean.length === 16)
  }

  const handleMockCardExpiry = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 4)
    let formatted = clean
    if (clean.length > 2) {
      formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`
    }
    setCardExpiryInput(formatted)
    if (clean.length === 4) {
      const mm = parseInt(clean.slice(0, 2))
      const yy = parseInt(clean.slice(2))
      setCardExpiryComplete(mm >= 1 && mm <= 12 && yy >= 24)
    } else {
      setCardExpiryComplete(false)
    }
  }

  const handleMockCardCvc = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 3)
    setCardCvcInput(clean)
    setCardCvcComplete(clean.length === 3)
  }
  
  const [step,setStep]=useState(0)
  const defaultSaved = user?.addresses?.find(a=>a.isDefault) || user?.addresses?.[0]
  const [addr,setAddr]=useState(defaultSaved || EMPTY_ADDR)
  const [isAutoFilled, setIsAutoFilled] = useState(!!defaultSaved)
  const [payment,setPayment]=useState("card")
  const [placing,setPlacing]=useState(false)
  
  const [pinError, setPinError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [emailError, setEmailError] = useState("")

  // Payment states
  const [cardHolder, setCardHolder] = useState("")
  const [cardNumberComplete, setCardNumberComplete] = useState(false)
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false)
  const [cardCvcComplete, setCardCvcComplete] = useState(false)
  const [cardError, setCardError] = useState("")
  const [cardBrand, setCardBrand] = useState("unknown")

  const [upiId, setUpiId] = useState("")
  const [upiVerified, setUpiVerified] = useState(false)
  const [upiVerifying, setUpiVerifying] = useState(false)
  const [upiError, setUpiError] = useState("")
  const [upiMethod, setUpiMethod] = useState("id") // "id" or "qr"
  const [selectedUpiApp, setSelectedUpiApp] = useState("")

  const [selectedBank, setSelectedBank] = useState("")

  const setA = (k,v) => setAddr(p=>({...p,[k]:v}))
  
  const handleSelectSaved = (a) => {
    setAddr(a)
    setIsAutoFilled(true)
    setPinError("")
    setPhoneError("")
    setEmailError("")
  }

  const handleAddNew = () => {
    setAddr(EMPTY_ADDR)
    setIsAutoFilled(false)
    setPinError("")
    setPhoneError("")
    setEmailError("")
  }

  const handleZipCodeChange = async (val) => {
    const cleanVal = val.replace(/\D/g, "").slice(0, 6)
    setAddr(prev => ({ ...prev, zipCode: cleanVal }))
    
    if (cleanVal.length === 6) {
      setPinError("")
      try {
        const res = await axios.get(`https://api.postalpincode.in/pincode/${cleanVal}`)
        if (res.data?.[0]?.Status === "Success") {
          const po = res.data[0].PostOffice[0]
          setAddr(prev => ({
            ...prev,
            city: po.District,
            state: po.State,
            country: "India"
          }))
          setIsAutoFilled(true)
          setPinError("")
        } else {
          setPinError("Invalid PIN Code")
          setIsAutoFilled(false)
        }
      } catch (err) {
        console.error(err)
        setPinError("Failed to lookup PIN code")
        setIsAutoFilled(false)
      }
    } else {
      setIsAutoFilled(false)
      if (cleanVal.length > 0 && cleanVal.length < 6) {
        setPinError("PIN Code must be 6 digits")
      } else {
        setPinError("")
      }
    }
  }

  const handlePhoneChange = (val) => {
    const cleanVal = val.replace(/\D/g, "").slice(0, 10)
    setAddr(prev => ({ ...prev, phone: cleanVal }))
    if (cleanVal.length > 0 && cleanVal.length < 10) {
      setPhoneError("Mobile number must be 10 digits")
    } else {
      setPhoneError("")
    }
  }

  const handleEmailChange = (val) => {
    setAddr(prev => ({ ...prev, email: val }))
    if (val.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setEmailError("Invalid email format")
    } else {
      setEmailError("")
    }
  }

  const verifyUpi = () => {
    if (!upiId.trim()) { setUpiError("UPI ID cannot be empty"); return }
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) { setUpiError("Invalid UPI ID format"); return }
    
    setUpiVerifying(true)
    setUpiError("")
    setUpiVerified(false)
    
    setTimeout(() => {
      setUpiVerifying(false)
      setUpiVerified(true)
      toast.success("UPI ID Verified successfully! ✓")
    }, 1200)
  }

  const validateAddr = () => {
    if (addr.address && addr.fullName && addr.phone && addr.city && addr.state && addr.zipCode) {
      return true
    }
    if (!addr.fullName?.trim()) { toast.error("Full Name is required"); return false }
    if (!addr.phone?.trim()) { toast.error("Mobile Number is required"); return false }
    if (addr.phone.length !== 10) { toast.error("Mobile Number must be 10 digits"); return false }
    if (phoneError) { toast.error(phoneError); return false }
    if (emailError) { toast.error(emailError); return false }
    if (!addr.houseNo?.trim()) { toast.error("House No./Flat No./Building Name is required"); return false }
    if (!addr.street?.trim()) { toast.error("Street/Road/Area is required"); return false }
    if (!addr.zipCode?.trim()) { toast.error("PIN Code is required"); return false }
    if (addr.zipCode.length !== 6) { toast.error("PIN Code must be 6 digits"); return false }
    if (pinError) { toast.error(pinError); return false }
    if (!addr.city?.trim()) { toast.error("City is required"); return false }
    if (!addr.state?.trim()) { toast.error("State is required"); return false }
    return true
  }

  const validatePayment = () => {
    if (payment === "card") {
      if (!cardHolder.trim()) { toast.error("Cardholder Name is required"); return false }
      if (!cardNumberComplete) { toast.error("Card Number is incomplete"); return false }
      if (!cardExpiryComplete) { toast.error("Expiry Date is incomplete"); return false }
      if (!cardCvcComplete) { toast.error("CVV is incomplete"); return false }
      if (cardError) { toast.error(cardError); return false }
      return true
    }
    if (payment === "upi") {
      if (upiMethod === "id") {
        if (!upiId.trim()) { toast.error("UPI ID is required"); return false }
        if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) { toast.error("Invalid UPI ID format"); return false }
        if (!upiVerified) { toast.error("Please verify your UPI ID first"); return false }
      }
      return true
    }
    if (payment === "netbanking") {
      if (!selectedBank) { toast.error("Please select a bank"); return false }
      return true
    }
    if (payment === "cod") {
      return true
    }
    return false
  }

  const orderItems = () => items.map(i=>({product:i.productId,name:i.name,image:i.image,price:i.price,size:i.size,color:i.color,quantity:i.quantity}))

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const placeOrder = async () => {
    setPlacing(true)
    try {
      const combined = [addr.houseNo, addr.street, addr.landmark].filter(Boolean).join(", ")
      const finalAddress = {
        fullName: addr.fullName,
        phone: addr.phone,
        address: addr.address || combined,
        city: addr.city,
        state: addr.state,
        zipCode: addr.zipCode,
        country: addr.country,
      }
      
      if (payment === "cod") {
        const { data } = await orderAPI.place({
          items: orderItems(), shippingAddress: finalAddress, paymentMethod: payment, couponCode
        })
        clearCart(); toast.success("Order placed! 🎉"); navigate(`/orders/${data.order._id}`,{replace:true})
        return
      }

      // Online Razorpay Payment
      const { data: orderData } = await paymentAPI.createOrder({ items: orderItems(), couponCode })
      
      const isMock = isDummyRazorpay || orderData.razorpayOrderId.startsWith("order_mock_");
      
      if (isMock) {
        // Simulate a successful verification call to the backend
        await new Promise(r => setTimeout(r, 1500))
        const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 11)}`;
        const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 11)}`;
        const { data } = await orderAPI.place({
          items: orderItems(),
          shippingAddress: finalAddress,
          paymentMethod: payment,
          razorpayOrderId: orderData.razorpayOrderId,
          razorpayPaymentId: mockPaymentId,
          razorpaySignature: mockSignature,
          couponCode
        })
        clearCart(); toast.success("Order placed! 🎉"); navigate(`/orders/${data.order._id}`,{replace:true})
      } else {
        const isLoaded = await loadRazorpayScript()
        if (!isLoaded) {
          toast.error("Razorpay SDK failed to load. Are you offline?")
          setPlacing(false)
          return
        }
        
        const rzpOptions = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: "INR",
          name: "LYVO",
          description: "Premium Products Purchase",
          image: "/logo.png",
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: finalAddress.fullName,
            email: addr.email || user?.email || "",
            contact: finalAddress.phone,
            method: payment === "card" ? "card" : payment === "upi" ? "upi" : payment === "netbanking" ? "netbanking" : undefined
          },
          theme: {
            color: "#111111"
          },
          handler: async function (response) {
            try {
              setPlacing(true)
              const { data } = await orderAPI.place({
                items: orderItems(),
                shippingAddress: finalAddress,
                paymentMethod: payment,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                couponCode
              })
              clearCart(); toast.success("Order placed! 🎉"); navigate(`/orders/${data.order._id}`,{replace:true})
            } catch (err) {
              toast.error(err.response?.data?.message || "Payment verification failed")
            } finally {
              setPlacing(false)
            }
          },
          modal: {
            ondismiss: function () {
              toast.error("Payment cancelled by customer")
              setPlacing(false)
            }
          }
        }
        
        const razor = new window.Razorpay(rzpOptions)
        razor.on("payment.failed", function (response) {
          toast.error(response.error.description || "Payment failed")
          setPlacing(false)
        })
        razor.open()
      }
    } catch(e) { 
      toast.error(e.response?.data?.message||"Failed to initialize payment") 
      setPlacing(false)
    }
  }

  const next = async () => {
    if (step === 0) {
      if (!validateAddr()) return
      
      if (addr.saveAddress && !addr.address) {
        const combined = [addr.houseNo, addr.street, addr.landmark].filter(Boolean).join(", ")
        const addressToSave = {
          fullName: addr.fullName,
          phone: addr.phone,
          address: combined,
          city: addr.city,
          state: addr.state,
          zipCode: addr.zipCode,
          country: addr.country,
          isDefault: user?.addresses?.length === 0,
        }
        try {
          await authAPI.addAddress(addressToSave)
          await fetchMe()
        } catch (err) {
          console.error("Failed to save address:", err)
        }
      }
    } else if (step === 1) {
      if (!validatePayment()) return
    }
    
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      placeOrder()
    }
  }

  return (
    <div className="page-top min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-4xl tracking-wider mb-8">Checkout</h1>
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((s,i)=>(
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <button onClick={()=>i<step&&setStep(i)} className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${i<step?"bg-acid border-acid text-dark-900":i===step?"border-acid text-acid":"border-white/15 text-white/30"}`}>{i<step?<FiCheck size={16}/>:i+1}</div>
                <span className={`hidden md:block text-sm font-medium transition-colors ${i===step?"text-white":i<step?"text-acid":"text-white/30"}`}>{s}</span>
              </button>
              {i<STEPS.length-1 && <div className={`flex-1 h-px mx-4 transition-all ${i<step?"bg-acid":"bg-white/10"}`}/>}
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {step===0 && (
                <motion.div key="addr" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-6"><FiMapPin className="text-acid" size={18}/><h2 className="font-semibold text-lg">Delivery Address</h2></div>
                    {user?.addresses?.length>0 && (
                      <div className="mb-6 space-y-3">
                        <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Saved Addresses</p>
                        {user.addresses.map(a=><button key={a._id} onClick={()=>handleSelectSaved(a)} className={`w-full text-left p-4 rounded-xl border transition-all ${addr.address === a.address || JSON.stringify(addr)===JSON.stringify(a)?"border-acid bg-acid/5":"border-white/10 hover:border-white/25"}`}><p className="font-medium text-sm">{a.fullName} · {a.phone}</p><p className="text-white/40 text-xs mt-1">{a.address}, {a.city}, {a.state} {a.zipCode}</p></button>)}
                        <button onClick={handleAddNew} className="text-acid text-sm hover:underline">+ Add new address</button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">Full Name</label>
                        <input 
                          type="text" 
                          value={addr.fullName || ""} 
                          onChange={e => setA("fullName", e.target.value)} 
                          className="input" 
                          placeholder="Jordan Miles"
                        />
                      </div>
                      
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">Mobile Number</label>
                        <input 
                          type="tel" 
                          value={addr.phone || ""} 
                          onChange={e => handlePhoneChange(e.target.value)} 
                          className={`input ${phoneError ? "border-fire focus:border-fire focus:ring-fire/30" : ""}`}
                          placeholder="9876543210"
                        />
                        {phoneError && <p className="text-xs text-fire mt-1">{phoneError}</p>}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="label">Email Address (Optional)</label>
                        <input 
                          type="email" 
                          value={addr.email || ""} 
                          onChange={e => handleEmailChange(e.target.value)} 
                          className={`input ${emailError ? "border-fire focus:border-fire focus:ring-fire/30" : ""}`}
                          placeholder="your@email.com"
                        />
                        {emailError && <p className="text-xs text-fire mt-1">{emailError}</p>}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="label">House No. / Flat No. / Building Name</label>
                        <input 
                          type="text" 
                          value={addr.houseNo || ""} 
                          onChange={e => setA("houseNo", e.target.value)} 
                          className="input" 
                          placeholder="Flat 402, Block A"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="label">Street / Road / Area</label>
                        <input 
                          type="text" 
                          value={addr.street || ""} 
                          onChange={e => setA("street", e.target.value)} 
                          className="input" 
                          placeholder="123 Vision Street, Bandra West"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="label">Landmark (Optional)</label>
                        <input 
                          type="text" 
                          value={addr.landmark || ""} 
                          onChange={e => setA("landmark", e.target.value)} 
                          className="input" 
                          placeholder="Near Axis Bank"
                        />
                      </div>
                      
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">PIN Code</label>
                        <input 
                          type="text" 
                          value={addr.zipCode || ""} 
                          onChange={e => handleZipCodeChange(e.target.value)} 
                          className={`input ${pinError ? "border-fire focus:border-fire focus:ring-fire/30" : ""}`}
                          placeholder="400001"
                        />
                        {pinError && <p className="text-xs text-fire mt-1">{pinError}</p>}
                      </div>
                      
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">City</label>
                        <input 
                          type="text" 
                          value={addr.city || ""} 
                          onChange={e => setA("city", e.target.value)} 
                          className="input"
                          placeholder="Mumbai"
                        />
                      </div>
                      
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">State</label>
                        <input 
                          type="text" 
                          value={addr.state || ""} 
                          readOnly={isAutoFilled}
                          className={`input ${isAutoFilled ? "opacity-65 cursor-not-allowed bg-dark-600/30 focus:border-white/10" : ""}`}
                          placeholder="Maharashtra"
                        />
                      </div>
                      
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">Country</label>
                        <input 
                          type="text" 
                          value="India"
                          readOnly
                          className="input opacity-65 cursor-not-allowed bg-dark-600/30 focus:border-white/10"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="label">Address Type</label>
                        <div className="flex gap-3">
                          {["Home", "Work", "Other"].map(t => (
                            <button 
                              key={t}
                              type="button"
                              onClick={() => setA("addressType", t)}
                              className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                                (addr.addressType || "Home") === t ? "border-acid bg-acid/15 text-acid" : "border-white/10 text-white/50 hover:border-white/20"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="col-span-2 flex items-center gap-2.5 mt-2">
                        <input 
                          type="checkbox" 
                          id="saveAddress" 
                          checked={addr.saveAddress || false} 
                          onChange={e => setA("saveAddress", e.target.checked)}
                          className="rounded border-white/10 text-acid focus:ring-acid focus:ring-offset-dark-900 focus:ring-1 w-4 h-4 bg-dark-600 cursor-pointer"
                        />
                        <label htmlFor="saveAddress" className="text-xs text-white/60 select-none cursor-pointer">
                          Save this address to my profile
                        </label>
                      </div>
                      
                      {/^\d{6}$/.test(addr.zipCode) && !pinError && (
                        <div className="col-span-2 mt-2 p-3.5 bg-dark-800 border border-white/10 rounded-xl flex items-center gap-2.5 animate-fade-in">
                          <FiCheck className="text-emerald-600 dark:text-emerald-400 shrink-0" size={16} />
                          <p className="text-xs text-white/70">
                            Delivery available to this PIN. Estimated delivery: <span className="font-semibold text-acid">2–4 business days</span>.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              {step===1 && (
                <motion.div key="pay" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-6"><FiCreditCard className="text-acid" size={18}/><h2 className="font-semibold text-lg">Payment Method</h2></div>
                    <div className="space-y-4">
                      {PAY_METHODS.map(m=>(
                        <div key={m.id} className={`rounded-xl border transition-all ${payment===m.id?"border-acid bg-acid/5":"border-white/10"}`}>
                          <button 
                            type="button"
                            onClick={()=>setPayment(m.id)} 
                            className={`w-full flex items-center gap-4 p-4 text-left transition-all ${payment===m.id?"text-white font-semibold":"text-white/60 hover:text-white"}`}
                          >
                            <span className="text-2xl">{m.icon}</span>
                            <span className="font-medium">{m.label}</span>
                            {payment===m.id && <FiCheck className="ml-auto text-acid" size={18}/>}
                          </button>
                          
                          {payment === m.id && (
                            <AnimatePresence>
                              {m.id === "card" && (
                                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="pl-4 pr-4 pb-4 overflow-hidden space-y-4">
                                  <div>
                                    <label className="label">Cardholder Name</label>
                                    <input 
                                      type="text" 
                                      value={cardHolder} 
                                      onChange={e => setCardHolder(e.target.value)} 
                                      className="input" 
                                      placeholder="Jordan Miles" 
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="label">Card Number</label>
                                    <input
                                      type="text"
                                      value={cardNumberInput}
                                      onChange={e => handleMockCardNumber(e.target.value)}
                                      className="input"
                                      placeholder="4242 4242 4242 4242"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="label">Expiry Date (MM/YY)</label>
                                      <input
                                        type="text"
                                        value={cardExpiryInput}
                                        onChange={e => handleMockCardExpiry(e.target.value)}
                                        className="input"
                                        placeholder="12/26"
                                      />
                                    </div>
                                    <div>
                                      <label className="label">CVV</label>
                                      <input
                                        type="text"
                                        value={cardCvcInput}
                                        onChange={e => handleMockCardCvc(e.target.value)}
                                        className="input"
                                        placeholder="123"
                                        maxLength={3}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2.5 mt-2">
                                    <input 
                                      type="checkbox" 
                                      id="saveCard" 
                                      className="rounded border-white/10 text-acid focus:ring-acid focus:ring-offset-dark-900 focus:ring-1 w-4 h-4 bg-dark-600 cursor-pointer"
                                    />
                                    <label htmlFor="saveCard" className="text-xs text-white/60 select-none cursor-pointer">
                                      Save this card for faster checkout
                                    </label>
                                  </div>
                                  
                                  {cardError && <p className="text-xs text-fire">{cardError}</p>}
                                </motion.div>
                              )}

                              {m.id === "upi" && (
                                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="pl-4 pr-4 pb-4 overflow-hidden space-y-4">
                                  <div className="flex border-b border-white/10">
                                    <button
                                      type="button"
                                      onClick={() => setUpiMethod("id")}
                                      className={`flex-1 pb-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${upiMethod === "id" ? "border-acid text-acid" : "border-transparent text-white/40"}`}
                                    >
                                      UPI ID
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setUpiMethod("qr")}
                                      className={`flex-1 pb-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${upiMethod === "qr" ? "border-acid text-acid" : "border-transparent text-white/40"}`}
                                    >
                                      Scan QR Code
                                    </button>
                                  </div>

                                  {upiMethod === "id" ? (
                                    <div className="space-y-4">
                                      <div>
                                        <label className="label">Enter UPI ID</label>
                                        <div className="flex gap-2">
                                          <input 
                                            type="text" 
                                            value={upiId}
                                            onChange={e => {
                                              setUpiId(e.target.value)
                                              setUpiVerified(false)
                                              setUpiError("")
                                            }}
                                            className="input flex-1" 
                                            placeholder="username@upi"
                                          />
                                          <button 
                                            type="button"
                                            onClick={verifyUpi}
                                            disabled={upiVerifying || !upiId.trim()}
                                            className="btn-primary px-4 text-xs shrink-0 py-2.5"
                                          >
                                            {upiVerifying ? "Verifying..." : upiVerified ? "Verified ✓" : "Verify"}
                                          </button>
                                        </div>
                                        {upiError && <p className="text-xs text-fire mt-1">{upiError}</p>}
                                        {upiVerified && <p className="text-xs text-acid mt-1 font-semibold">✓ Verified Name: {addr.fullName || "User"}</p>}
                                      </div>

                                      <div>
                                        <label className="label">Or Select App</label>
                                        <div className="grid grid-cols-4 gap-2">
                                          {["GPay", "PhonePe", "Paytm", "BHIM"].map(app => (
                                            <button
                                              key={app}
                                              type="button"
                                              onClick={() => {
                                                setSelectedUpiApp(app)
                                                setUpiId(prev => {
                                                  const prefix = prev.split("@")[0] || ""
                                                  const suffixes = { GPay: "okaxis", PhonePe: "ybl", Paytm: "paytm", BHIM: "upi" }
                                                  return `${prefix}@${suffixes[app]}`
                                                })
                                                setUpiVerified(false)
                                              }}
                                              className={`py-2.5 text-[10px] font-semibold border rounded-lg transition-all ${
                                                selectedUpiApp === app ? "border-acid bg-acid/15 text-acid" : "border-white/10 text-white/50 hover:border-white/25"
                                              }`}
                                            >
                                              {app}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center py-5 bg-dark-800 border border-white/10 rounded-2xl animate-fade-in">
                                      <div className="w-36 h-36 bg-white p-2 rounded-xl flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" className="w-full h-full text-black">
                                          <path fill="currentColor" d="M10,10 h30 v30 h-30 z M15,15 h20 v20 h-20 z M22,22 h6 v6 h-6 z" />
                                          <path fill="currentColor" d="M60,10 h30 v30 h-30 z M65,15 h20 v20 h-20 z M72,22 h6 v6 h-6 z" />
                                          <path fill="currentColor" d="M10,60 h30 v30 h-30 z M15,65 h20 v20 h-20 z M22,72 h6 v6 h-6 z" />
                                          <path fill="currentColor" d="M60,60 h10 v10 h-10 z M80,60 h10 v10 h-10 z M70,70 h10 v10 h-10 z M80,80 h10 v10 h-10 z M60,80 h10 v10 h-10 z" />
                                          <path fill="currentColor" d="M45,10 h5 v5 h-5 z M50,20 h5 v5 h-5 z M45,30 h5 v5 h-5 z M55,35 h5 v5 h-5 z" />
                                          <path fill="currentColor" d="M10,45 h5 v5 h-5 z M20,50 h5 v5 h-5 z M30,45 h5 v5 h-5 z M35,55 h5 v5 h-5 z" />
                                        </svg>
                                      </div>
                                      <p className="text-[10px] text-white/50 mt-3 text-center leading-relaxed">
                                        Scan this QR code using any UPI app to pay<br/><span className="font-semibold text-acid">₹{total.toLocaleString()}</span> securely.
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              )}

                              {m.id === "netbanking" && (
                                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="pl-4 pr-4 pb-4 overflow-hidden space-y-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {POPULAR_BANKS.map(b => (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setSelectedBank(b.name)}
                                        className={`px-3 py-2.5 text-xs text-left font-medium rounded-xl border transition-all truncate ${
                                          selectedBank === b.name ? "border-acid bg-acid/15 text-acid" : "border-white/10 text-white/60 hover:border-white/20"
                                        }`}
                                      >
                                        🏦 {b.name}
                                      </button>
                                    ))}
                                  </div>
                                  
                                  <div className="relative">
                                    <label className="label">Or Select Other Bank</label>
                                    <select 
                                      value={OTHER_BANKS.includes(selectedBank) ? selectedBank : ""} 
                                      onChange={e => setSelectedBank(e.target.value)}
                                      className="input"
                                    >
                                      <option value="">-- Choose Bank --</option>
                                      {OTHER_BANKS.map(b => (
                                        <option key={b} value={b}>{b}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="p-3.5 bg-dark-800 border border-white/10 rounded-xl flex items-start gap-2.5">
                                    <FiCheck className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" size={15} />
                                    <p className="text-xs text-white/50 leading-relaxed">
                                      You will be securely redirected to <span className="text-white font-medium">{selectedBank || "your bank"}</span> for authentication and payment authorization.
                                    </p>
                                  </div>
                                </motion.div>
                              )}

                              {m.id === "cod" && (
                                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="pl-4 pr-4 pb-4 overflow-hidden">
                                  <div className="space-y-4 pt-2">
                                    <div className="flex items-start gap-3 text-emerald-600 dark:text-emerald-400">
                                      <FiCheck className="mt-0.5 shrink-0" size={18} />
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider">Cash on Delivery Available</p>
                                        <p className="text-xs text-white/50 mt-1 leading-relaxed">
                                          Cash on Delivery is fully supported for delivery to PIN code <span className="font-semibold text-white/80">{addr.zipCode || "your address"}</span>.
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4 text-xs">
                                      <div>
                                        <p className="text-white/40 uppercase tracking-widest text-[10px] font-semibold">COD Charges</p>
                                        <p className="font-medium text-white/80 mt-1">Free (₹0)</p>
                                      </div>
                                      <div>
                                        <p className="text-white/40 uppercase tracking-widest text-[10px] font-semibold">Delivery Time</p>
                                        <p className="font-medium text-white/80 mt-1">2–4 Business Days</p>
                                      </div>
                                      <div className="col-span-2">
                                        <p className="text-white/40 uppercase tracking-widest text-[10px] font-semibold">Order Restrictions</p>
                                        <p className="font-medium text-white/80 mt-1">Available for orders up to ₹50,000</p>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-6 text-white/30 text-xs"><FiCheck size={13} className="text-acid"/> 256-bit SSL encrypted.</div>
                  </div>
                </motion.div>
              )}
              {step===2 && (
                <motion.div key="review" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <div className="card p-6 space-y-6">
                    <div className="flex items-center gap-2 mb-2"><FiPackage className="text-acid" size={18}/><h2 className="font-semibold text-lg">Review Order</h2></div>
                    <div className="bg-dark-700/50 rounded-xl p-4">
                      <p className="text-white/40 text-xs uppercase mb-2">Delivery To</p>
                      <p className="font-medium">{addr.fullName} · {addr.phone}</p>
                      <p className="text-white/50 text-sm">
                        {addr.address || [addr.houseNo, addr.street, addr.landmark].filter(Boolean).join(", ")}, {addr.city}, {addr.state} {addr.zipCode}
                      </p>
                    </div>
                    <div className="bg-dark-700/50 rounded-xl p-4"><p className="text-white/40 text-xs uppercase mb-2">Payment</p><p className="font-medium capitalize">{PAY_METHODS.find(m=>m.id===payment)?.label}</p></div>
                    <div className="space-y-3">{items.map((item,i)=><div key={i} className="flex items-center gap-3"><div className="w-14 h-14 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={item.image} alt="" className="w-full h-full object-cover"/></div><div className="flex-1 min-w-0"><p className="font-medium text-sm line-clamp-1">{item.name}</p><p className="text-white/40 text-xs">Size: {item.size} · Qty: {item.quantity}</p></div><p className="font-semibold text-acid text-sm shrink-0">₹{(item.price*item.quantity).toLocaleString()}</p></div>)}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex gap-3 mt-6">
              {step>0 && <button onClick={()=>setStep(s=>s-1)} className="btn-outline flex items-center gap-2"><FiArrowLeft size={16}/> Back</button>}
              <button onClick={next} disabled={placing} className="btn-primary flex-1 flex items-center justify-center gap-2 py-4">{placing?<span className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:step===STEPS.length-1?<><FiCheck size={16}/> Place Order</>:<>Next <FiArrowRight size={16}/></>}</button>
            </div>
          </div>
          <div className="card p-6 space-y-4 h-fit sticky top-22">
            <h3 className="font-semibold">Order Total</h3>
            <div className="space-y-2.5 text-sm">{[["Items",`₹${subtotal.toLocaleString()}`],["Shipping",shippingCost===0?"Free":`₹${shippingCost}`],["GST (18%)",`₹${tax.toLocaleString()}`],...(couponDiscount>0?[["Coupon",`-₹${couponDiscount.toLocaleString()}`]]:[])].map(([l,v])=><div key={l} className="flex justify-between"><span className="text-white/50">{l}</span><span className={l==="Coupon"||(l==="Shipping"&&shippingCost===0)?"text-acid":"text-white/80"}>{v}</span></div>)}<div className="border-t border-white/8 pt-3 flex justify-between font-bold text-base"><span>Total</span><span className="text-acid text-xl">₹{(total - (couponDiscount || 0)).toLocaleString()}</span></div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return <Checkout/>
}
