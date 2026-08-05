import { useState } from "react"
import { FiX } from "react-icons/fi"

const REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Product damaged/defective",
  "Product not as described",
  "Delivery taking too long",
  "Changed my mind",
  "Other",
]

// type: "cancel" | "return"
export default function CancelReturnModal({ type, onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState("")
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = () => {
    if (!reason) { setError("Please select a reason"); return }
    onSubmit({ reason, comment })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg">{type==="cancel" ? "Cancel Order" : "Return Order"}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><FiX size={18}/></button>
        </div>
        <p className="text-white/50 text-sm mb-4">Please tell us why — this helps us improve.</p>
        <div className="space-y-2 mb-4">
          {REASONS.map(r => (
            <button key={r} onClick={()=>setReason(r)} className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${reason===r?"border-acid bg-acid/5 text-white":"border-white/10 text-white/60 hover:border-white/25"}`}>{r}</button>
          ))}
        </div>
        {reason==="Other" && (
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} maxLength={500} placeholder="Tell us more…" className="input resize-none mb-4"/>
        )}
        {error && <p className="text-fire text-xs mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 py-3">{submitting?"Submitting…":"Submit"}</button>
          <button onClick={onClose} disabled={submitting} className="btn-outline py-3 px-5">Nevermind</button>
        </div>
      </div>
    </div>
  )
}
