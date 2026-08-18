import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiMessageSquare, FiX, FiSend, FiArrowRight } from "react-icons/fi"

const FAQS = [
  { q: "How long does shipping take?", a: "Metro cities in India take 2-4 business days. Other regions are delivered in 3-5 days." },
  { q: "What is your return policy?", a: "We offer a 30-day exchange and returns window. The items must be unworn and in original box packaging." },
  { q: "How do I choose my size?", a: "LYVO shoes fit true to UK shoe sizing. If you wear half sizes, we recommend ordering a size up." },
]

export default function ChatbotFloat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Welcome to LYVO Concierge. How can we support your streetwear search today?" }
  ])
  const [input, setInput] = useState("")

  const handleSend = (text) => {
    const val = text || input
    if (!val.trim()) return
    
    setMessages((p) => [...p, { sender: "user", text: val }])
    if (!text) setInput("")

    // Automated matching logic
    setTimeout(() => {
      let response = "Thank you for contacting Concierge. We will connect you to a representative shortly."
      const query = val.toLowerCase()
      if (query.includes("ship") || query.includes("delivery") || query.includes("time")) {
        response = FAQS[0].a
      } else if (query.includes("return") || query.includes("exchange") || query.includes("refund")) {
        response = FAQS[1].a
      } else if (query.includes("size") || query.includes("fit")) {
        response = FAQS[2].a
      }
      setMessages((p) => [...p, { sender: "bot", text: response }])
    }, 800)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-acid text-dark-900 rounded-full flex items-center justify-center shadow-[0_4px_24px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-all z-40"
        aria-label="Open virtual concierge chatbot"
      >
        <FiMessageSquare size={22} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed bottom-24 right-6 w-80 sm:w-96 h-[460px] glass rounded-3xl border border-white/10 shadow-card flex flex-col overflow-hidden z-40"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/8 bg-white/2 flex items-center justify-between">
              <div>
                <h4 className="font-display tracking-wider uppercase text-sm">Concierge</h4>
                <p className="text-[10px] text-acid font-mono uppercase tracking-widest">Online Support</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white">
                <FiX size={18} />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      m.sender === "user"
                        ? "bg-acid text-dark-900 font-medium"
                        : "bg-dark-800 text-white/80 border border-white/5"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Suggestions */}
            <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-white/5 bg-white/[0.01]">
              {FAQS.map((faq) => (
                <button
                  key={faq.q}
                  onClick={() => handleSend(faq.q)}
                  className="text-[10px] text-white/50 hover:text-acid border border-white/10 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1 bg-dark-900"
                >
                  {faq.q} <FiArrowRight size={10} />
                </button>
              ))}
            </div>

            {/* Form Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="p-3 border-t border-white/8 bg-dark-900 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask concierge about orders, sizes..."
                className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none px-2"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-8 h-8 bg-acid/20 text-acid rounded-xl flex items-center justify-center hover:bg-acid hover:text-dark-900 disabled:opacity-30 transition-all shrink-0"
              >
                <FiSend size={12} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
