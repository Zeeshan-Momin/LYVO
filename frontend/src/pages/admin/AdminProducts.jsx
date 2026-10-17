import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiCheck, FiAlertTriangle, FiStar, FiPackage, FiChevronDown, FiActivity, FiCompass, FiCircle, FiTag } from "react-icons/fi"
import { productAPI, adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import toast from "react-hot-toast"

const FOOTWEAR_SIZES = ["UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11", "UK 12"]
const BELT_SIZES = ["28", "30", "32", "34", "36", "38", "40", "Free Size"]
const SOCK_SIZES = ["Free Size", "S-M", "L-XL", "UK 6-8", "UK 9-11"]
const AVAILABLE_SIZES = FOOTWEAR_SIZES

const getCategoryIcon = (name) => {
  const lower = (name || "").toLowerCase()
  if (lower.includes("run")) return <FiActivity size={14} className="text-acid/80 shrink-0" />
  if (lower.includes("life") || lower.includes("casual")) return <FiCompass size={14} className="text-blue-400 shrink-0" />
  if (lower.includes("basket")) return <FiCircle size={14} className="text-orange-400 shrink-0" />
  if (lower.includes("train") || lower.includes("gym")) return <FiActivity size={14} className="text-emerald-400 shrink-0" />
  if (lower.includes("limit") || lower.includes("ed")) return <FiStar size={14} className="text-yellow-400 shrink-0" />
  if (lower.includes("belt")) return <FiTag size={14} className="text-amber-400 shrink-0" />
  if (lower.includes("sock")) return <FiTag size={14} className="text-cyan-400 shrink-0" />
  return <FiTag size={14} className="text-white/40 shrink-0" />
}

function CategorySelect({ value, onChange, categories = [], required }) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const listboxRef = useRef(null)

  const selectedCategory = categories.find(c => c._id === value || c.name === value)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      const idx = categories.findIndex(c => c._id === value || c.name === value)
      setHighlightedIndex(idx >= 0 ? idx : 0)
    }
  }, [isOpen, value, categories])

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === "Escape") {
      e.preventDefault()
      setIsOpen(false)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev + 1) % categories.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev - 1 + categories.length) % categories.length)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < categories.length) {
        onChange(categories[highlightedIndex]._id)
        setIsOpen(false)
      }
    } else if (e.key === "Tab") {
      setIsOpen(false)
    }
  }

  const handleSelect = (categoryId) => {
    onChange(categoryId)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="category-listbox"
        aria-required={required}
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        className={`input w-full flex items-center justify-between text-left cursor-pointer select-none transition-all py-2.5 px-3.5 group ${
          isOpen ? "border-acid/60 ring-1 ring-acid/30" : "hover:border-white/20"
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedCategory ? (
            <>
              {getCategoryIcon(selectedCategory.name)}
              <span className="text-sm font-medium text-white">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-sm text-white/30">Select category</span>
          )}
        </div>
        <FiChevronDown
          size={16}
          className={`text-white/40 group-hover:text-white transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "rotate-180 text-acid" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="category-listbox"
            role="listbox"
            ref={listboxRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-dark-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 max-h-56 overflow-y-auto"
          >
            {categories.length === 0 ? (
              <div className="px-4 py-3 text-xs text-white/40 text-center">No categories found</div>
            ) : (
              categories.map((c, idx) => {
                const isSelected = c._id === value || c.name === value
                const isHighlighted = idx === highlightedIndex
                return (
                  <div
                    key={c._id}
                    id={`category-option-${c._id}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(c._id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer text-xs transition-colors select-none ${
                      isSelected
                        ? "bg-acid/15 text-acid font-semibold"
                        : isHighlighted
                        ? "bg-white/5 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {getCategoryIcon(c.name)}
                      <span className="truncate">{c.name}</span>
                    </div>
                    {isSelected && <FiCheck size={14} className="text-acid shrink-0 ml-2" />}
                  </div>
                )
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const parseColors = (input) => {
  if (!input) return []
  if (Array.isArray(input)) {
    return input
      .map(c => {
        if (typeof c === "object" && c !== null) return { name: c.name?.trim() || "", hex: c.hex?.trim() || "#000000" }
        if (typeof c === "string") {
          const [name, hex] = c.split(":")
          return { name: name?.trim() || "", hex: hex?.trim() || "#000000" }
        }
        return null
      })
      .filter(c => c && c.name)
  }
  if (typeof input === "string") {
    return input
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        const [name, hex] = l.split(":")
        return { name: name?.trim() || "", hex: hex?.trim() || "#000000" }
      })
      .filter(c => c.name)
  }
  return []
}

const parseSizes = (input) => {
  if (!input) return []
  if (Array.isArray(input)) {
    return input
      .map(s => {
        if (typeof s === "object" && s !== null) return { size: s.size?.trim() || "", stock: Math.max(0, parseInt(s.stock, 10) || 0) }
        if (typeof s === "string") {
          const [size, stock] = s.split(":")
          return { size: size?.trim() || "", stock: Math.max(0, parseInt(stock, 10) || 0) }
        }
        return null
      })
      .filter(s => s && s.size)
  }
  if (typeof input === "string") {
    return input
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        const [size, stock] = l.split(":")
        return { size: size?.trim() || "", stock: Math.max(0, parseInt(stock, 10) || 0) }
      })
      .filter(s => s.size)
  }
  return []
}

const EMPTY = {
  name: "",
  brand: "LYVO",
  description: "",
  shortDescription: "",
  gender: "unisex",
  price: "",
  discountPrice: "",
  category: "",
  isFeatured: false,
  isNew: true,
  isBestSeller: false,
  isActive: true,
  tags: "",
  features: "",
  weightGrams: "",
  lengthCm: "",
  widthCm: "",
  heightCm: ""
}

function ProductForm({ product, categories, onSave, onClose }) {
  const [form, setForm] = useState(
    product
      ? {
          ...product,
          category: product.category?._id || product.category || "",
          tags: product.tags?.join(",") || "",
          features: product.features?.join("\n") || "",
          weightGrams: product.weightGrams ?? "",
          lengthCm: product.lengthCm ?? "",
          widthCm: product.widthCm ?? "",
          heightCm: product.heightCm ?? ""
        }
      : EMPTY
  )

  const [colors, setColors] = useState(() => parseColors(product?.colors))
  const [newColorName, setNewColorName] = useState("")
  const [newColorHex, setNewColorHex] = useState("#1a1a1a")

  const [sizes, setSizes] = useState(() => parseSizes(product?.sizes))
  const [sizePreset, setSizePreset] = useState("footwear")
  const [customSizeInput, setCustomSizeInput] = useState("")

  useEffect(() => {
    const selectedCat = categories.find(c => c._id === form.category || c.name === form.category);
    const catName = (selectedCat?.name || "").toLowerCase();
    if (catName.includes("belt")) setSizePreset("belts");
    else if (catName.includes("sock")) setSizePreset("socks");
    else if (catName.includes("run") || catName.includes("life") || catName.includes("basket") || catName.includes("train")) setSizePreset("footwear");
  }, [form.category, categories]);

  const [previews, setPreviews] = useState(
    product?.images?.map((i, idx) => ({
      url: i.url,
      existing: true,
      publicId: i.publicId,
      isPrimary: i.isPrimary ?? (idx === 0)
    })) || []
  )
  const [deletedImages, setDeletedImages] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Color handlers
  const addColor = () => {
    const name = newColorName.trim()
    if (!name) {
      toast.error("Color name is required")
      return
    }
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    if (!hexRegex.test(newColorHex)) {
      toast.error("Valid hex color required")
      return
    }
    if (colors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Color "${name}" is already added`)
      return
    }
    setColors(prev => [...prev, { name, hex: newColorHex }])
    setNewColorName("")
  }

  const removeColor = (idx) => {
    setColors(prev => prev.filter((_, i) => i !== idx))
  }

  const activePresetSizes =
    sizePreset === "belts" ? BELT_SIZES : sizePreset === "socks" ? SOCK_SIZES : FOOTWEAR_SIZES;

  // Size handlers
  const toggleSize = (sz) => {
    setSizes(prev => {
      if (prev.some(s => s.size === sz)) {
        return prev.filter(s => s.size !== sz)
      }
      return [...prev, { size: sz, stock: "" }]
    })
  }

  const selectAllSizes = () => {
    setSizes(prev => {
      const existingMap = new Map(prev.map(s => [s.size, s.stock]))
      return activePresetSizes.map(sz => ({
        size: sz,
        stock: existingMap.has(sz) ? existingMap.get(sz) : ""
      }))
    })
  }

  const clearAllSizes = () => {
    setSizes([])
  }

  const addCustomSize = () => {
    const trimmed = customSizeInput.trim()
    if (!trimmed) {
      toast.error("Enter size name")
      return
    }
    if (sizes.some(s => s.size.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Size "${trimmed}" is already added`)
      return
    }
    setSizes(prev => [...prev, { size: trimmed, stock: "" }])
    setCustomSizeInput("")
  }

  const updateSizeStock = (sz, val) => {
    if (val === "") {
      setSizes(prev => prev.map(s => s.size === sz ? { ...s, stock: "" } : s))
      return
    }
    const parsed = Math.max(0, parseInt(val, 10))
    setSizes(prev => prev.map(s => s.size === sz ? { ...s, stock: isNaN(parsed) ? "" : parsed } : s))
  }

  const removeSize = (sz) => {
    setSizes(prev => prev.filter(s => s.size !== sz))
  }

  const setPrimary = (index) => {
    setPreviews(prev => prev.map((p, i) => ({ ...p, isPrimary: i === index })))
  }

  const pickFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    if (!picked.length) return

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    const maxSize = 5 * 1024 * 1024 // 5 MB

    const validFiles = []
    for (const file of picked) {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        toast.error(`${file.name}: Invalid format. Allowed: JPG, PNG, WEBP`)
        continue
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: Exceeds 5MB size limit`)
        continue
      }
      validFiles.push(file)
    }

    if (previews.length + validFiles.length > 6) {
      toast.error(`Maximum 6 images allowed per product. You can only add ${Math.max(0, 6 - previews.length)} more.`)
      validFiles.splice(6 - previews.length)
    }

    if (validFiles.length > 0) {
      const newPreviews = validFiles.map(f => ({
        url: URL.createObjectURL(f),
        existing: false,
        file: f,
        isPrimary: false
      }))

      setPreviews(prev => {
        const combined = [...prev, ...newPreviews]
        if (!combined.some(p => p.isPrimary) && combined.length > 0) {
          combined[0].isPrimary = true
        }
        return combined
      })
    }

    if (fileRef.current) fileRef.current.value = ""
  }

  const removePreview = (index) => {
    const item = previews[index]
    if (item.existing && item.publicId) {
      setDeletedImages(prev => [...prev, item.publicId])
    }
    setPreviews(prev => {
      const remaining = prev.filter((_, i) => i !== index)
      if (item.isPrimary && remaining.length > 0) {
        remaining[0].isPrimary = true
      }
      return remaining
    })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.price || !form.category) {
      toast.error("Name, price and category required")
      return
    }

    if (previews.length > 6) {
      toast.error("Maximum 6 images allowed")
      return
    }

    // Validate size stock quantities
    for (const s of sizes) {
      if (s.stock === "" || s.stock === null || s.stock === undefined || isNaN(s.stock) || Number(s.stock) < 0 || !Number.isInteger(Number(s.stock))) {
        toast.error(`Please enter a valid stock quantity for size ${s.size}`)
        return
      }
    }

    setSaving(true)
    try {
      const fd = new FormData()
      const formattedSizes = sizes.map(s => ({
        size: s.size.trim(),
        stock: parseInt(s.stock, 10)
      }))
      const formattedColors = colors.map(c => ({
        name: c.name.trim(),
        hex: c.hex.trim() || "#1a1a1a"
      }))
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean)
      const features = form.features.split("\n").map(f => f.trim()).filter(Boolean)

      const payload = {
        ...form,
        tags,
        features,
        sizes: formattedSizes,
        colors: formattedColors,
        price: +form.price,
        discountPrice: form.discountPrice !== "" ? +form.discountPrice : 0,
        weightGrams: form.weightGrams !== "" ? +form.weightGrams : null,
        lengthCm: form.lengthCm !== "" ? +form.lengthCm : null,
        widthCm: form.widthCm !== "" ? +form.widthCm : null,
        heightCm: form.heightCm !== "" ? +form.heightCm : null
      }
      delete payload.images

      // Find primary index in current previews order
      const primaryIdx = previews.findIndex(p => p.isPrimary)
      fd.append("primaryIndex", primaryIdx >= 0 ? primaryIdx : 0)

      // Existing images to keep
      const existingImages = previews
        .filter(p => p.existing)
        .map(p => ({
          url: p.url,
          publicId: p.publicId,
          alt: form.name || "Product Image",
          isPrimary: !!p.isPrimary
        }))
      fd.append("existingImages", JSON.stringify(existingImages))

      Object.entries(payload).forEach(([k, v]) => {
        if (typeof v === "object" && v !== null) fd.append(k, JSON.stringify(v))
        else if (v !== "" && v !== undefined && v !== null) fd.append(k, v)
      })

      // Append new files
      const newFiles = previews.filter(p => !p.existing).map(p => p.file)
      newFiles.forEach(f => fd.append("images", f))

      if (product?._id) {
        for (const pid of deletedImages) {
          if (pid) {
            await productAPI.deleteImage(product._id, { publicId: pid }).catch(console.error)
          }
        }
        await productAPI.update(product._id, fd)
      } else {
        await productAPI.create(fd)
      }

      toast.success(product ? "Product updated!" : "Product created!")
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-4xl">
          <div className="flex items-center justify-between p-6 border-b border-white/8">
            <h2 className="font-semibold text-xl">{product ? "Edit Product" : "Add Product"}</h2>
            <button type="button" onClick={onClose} className="btn-ghost p-2 rounded-full">
              <FiX size={20} />
            </button>
          </div>
          <form onSubmit={save} className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="label">Product Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="label">Brand</label>
                  <input value={form.brand} onChange={e => set("brand", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Category *</label>
                  <CategorySelect
                    value={form.category}
                    onChange={val => set("category", val)}
                    categories={categories}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Price (₹) *</label>
                    <input type="number" value={form.price} onChange={e => set("price", e.target.value)} className="input" required min={0} />
                  </div>
                  <div>
                    <label className="label">Discount Price</label>
                    <input type="number" value={form.discountPrice} onChange={e => set("discountPrice", e.target.value)} className="input" min={0} />
                  </div>
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select value={form.gender} onChange={e => set("gender", e.target.value)} className="input">
                    {["men", "women", "unisex", "kids"].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Description *</label>
                  <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={4} className="input resize-none" required />
                </div>

                {/* Shipping Dimensions & Weight (Delhivery) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/80 uppercase tracking-wider">
                    <FiPackage className="text-acid" size={15} />
                    <span>Package Dimensions (Delhivery Shipping)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-white/50 block mb-1">Weight (grams)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 850"
                        value={form.weightGrams}
                        onChange={e => set("weightGrams", e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/50 block mb-1">Length (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g. 32"
                        value={form.lengthCm}
                        onChange={e => set("lengthCm", e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/50 block mb-1">Width (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g. 20"
                        value={form.widthCm}
                        onChange={e => set("widthCm", e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/50 block mb-1">Height (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g. 12"
                        value={form.heightCm}
                        onChange={e => set("heightCm", e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label mb-0">Images ({previews.length}/6)</label>
                    <span className="text-[11px] text-white/40">JPG, PNG, WEBP (Max 5MB each)</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-2">
                    {previews.map((p, i) => (
                      <div
                        key={i}
                        className={`relative aspect-square rounded-2xl overflow-hidden bg-dark-600 border-2 transition-all group ${
                          p.isPrimary ? "border-acid shadow-[0_0_12px_rgba(200,255,0,0.15)]" : "border-white/10"
                        }`}
                      >
                        <img src={p.url} alt="" className="w-full h-full object-cover" />

                        {/* Primary Badge */}
                        {p.isPrimary && (
                          <div className="absolute top-1.5 left-1.5 bg-acid text-dark-900 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow">
                            <FiStar size={10} className="fill-current" />
                            Primary
                          </div>
                        )}

                        {/* Overlay Controls */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                          {!p.isPrimary && (
                            <button
                              type="button"
                              onClick={() => setPrimary(i)}
                              title="Set as Primary"
                              className="p-1.5 rounded-lg bg-white/20 hover:bg-acid hover:text-dark-900 text-white transition-colors"
                            >
                              <FiStar size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removePreview(i)}
                            title="Remove Image"
                            className="p-1.5 rounded-lg bg-white/20 hover:bg-fire text-white transition-colors"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {previews.length < 6 && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="aspect-square rounded-2xl border-2 border-dashed border-white/15 hover:border-acid/50 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 text-white/40 hover:text-acid transition-all"
                      >
                        <FiPlus size={22} />
                        <span className="text-xs font-medium">Add Image</span>
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    className="hidden"
                    onChange={pickFiles}
                  />
                </div>

                {/* Colors Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="label mb-0">Colors ({colors.length})</label>
                    <span className="text-[11px] text-white/40">Visual color picker</span>
                  </div>

                  {/* Add Color Input Row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Midnight Black"
                      value={newColorName}
                      onChange={e => setNewColorName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addColor()
                        }
                      }}
                      className="input text-xs py-2 flex-1"
                    />
                    <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-dark-700 border border-white/10 shrink-0 overflow-hidden cursor-pointer hover:border-white/30 transition-all">
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={e => setNewColorHex(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        title="Choose color"
                      />
                      <span
                        className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: newColorHex }}
                      />
                    </div>
                    <span className="text-xs font-mono text-white/60 shrink-0 uppercase w-16 text-center">{newColorHex}</span>
                    <button
                      type="button"
                      onClick={addColor}
                      className="btn-outline px-3 py-2 text-xs shrink-0 flex items-center gap-1 hover:border-acid hover:text-acid transition-all"
                    >
                      <FiPlus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Added Colors List */}
                  {colors.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {colors.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-dark-700/80 border border-white/10 rounded-xl px-2.5 py-1.5 shadow-sm group hover:border-white/20 transition-all"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-sm"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs font-medium text-white">{c.name}</span>
                          <span className="text-[10px] font-mono text-white/40 uppercase">{c.hex}</span>
                          <button
                            type="button"
                            onClick={() => removeColor(i)}
                            title="Remove color"
                            className="text-white/40 hover:text-fire transition-colors ml-0.5 p-0.5"
                          >
                            <FiX size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sizes & Stock Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="label mb-0">Sizes & Stock ({sizes.length} selected)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllSizes}
                        className="text-[11px] text-acid/80 hover:text-acid hover:underline font-medium transition-colors"
                      >
                        Select All
                      </button>
                      <span className="text-white/20 text-xs">•</span>
                      <button
                        type="button"
                        onClick={clearAllSizes}
                        className="text-[11px] text-white/40 hover:text-fire hover:underline transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Size Preset Selector Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-dark-700/60 rounded-xl border border-white/5">
                    {[
                      { id: "footwear", label: "Footwear" },
                      { id: "belts", label: "Belts" },
                      { id: "socks", label: "Socks" }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSizePreset(p.id)}
                        className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-all ${
                          sizePreset === p.id
                            ? "bg-acid/20 text-acid font-semibold border border-acid/30"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Preset Size Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {activePresetSizes.map(sz => {
                      const isSelected = sizes.some(s => s.size === sz)
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => toggleSize(sz)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1 ${
                            isSelected
                              ? "bg-acid/15 border-acid text-acid font-semibold shadow-sm shadow-acid/10"
                              : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          <span>{sz}</span>
                          {isSelected && <FiCheck size={12} className="shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom Size Adder */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Custom size (e.g. Free Size, 34, XL)"
                      value={customSizeInput}
                      onChange={e => setCustomSizeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCustomSize()
                        }
                      }}
                      className="input text-xs py-1.5 flex-1"
                    />
                    <button
                      type="button"
                      onClick={addCustomSize}
                      className="btn-outline px-3 py-1.5 text-xs shrink-0 flex items-center gap-1 hover:border-acid hover:text-acid"
                    >
                      <FiPlus size={13} />
                      <span>Add Size</span>
                    </button>
                  </div>

                  {/* Stock Input for Selected Sizes */}
                  {sizes.length > 0 && (
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[11px] text-white/40 font-medium px-1">
                        <span>Size</span>
                        <span>Stock Quantity</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                        {sizes.map(s => (
                          <div
                            key={s.size}
                            className="flex items-center justify-between gap-2 bg-dark-700/60 border border-white/5 rounded-xl px-2.5 py-1.5"
                          >
                            <span className="text-xs font-semibold text-white/90 shrink-0">{s.size}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={s.stock === 0 ? "0" : s.stock || ""}
                                onChange={e => updateSizeStock(s.size, e.target.value)}
                                className="input text-xs py-1 px-2 w-16 text-right font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => removeSize(s.size)}
                                title="Remove size"
                                className="text-white/30 hover:text-fire transition-colors p-0.5"
                              >
                                <FiX size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Tags (comma separated)</label>
                  <input value={form.tags} onChange={e => set("tags", e.target.value)} className="input" placeholder="running, lightweight" />
                </div>
                <div>
                  <label className="label">Features (one per line)</label>
                  <textarea value={form.features} onChange={e => set("features", e.target.value)} rows={3} className="input resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["isFeatured", "Featured"],
                    ["isNew", "New Arrival"],
                    ["isBestSeller", "Best Seller"],
                    ["isActive", "Active"]
                  ].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} className="accent-acid" />
                      <span className="text-sm text-white/70">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-white/8">
              <button type="button" onClick={onClose} className="btn-ghost px-6 py-3">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <FiCheck size={16} /> {product ? "Update" : "Create"} Product
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function AdminProducts() {
  const [products,setProducts]=useState([]), [categories,setCategories]=useState([]), [loading,setLoading]=useState(true)
  const [search,setSearch]=useState(""), [editProduct,setEditProduct]=useState(null), [showForm,setShowForm]=useState(false), [deleting,setDeleting]=useState(null)
  const [pagination,setPagination]=useState({}), [page,setPage]=useState(1)
  const fetchData = async () => {
    setLoading(true)
    try { const [pRes,cRes]=await Promise.all([productAPI.getAll({page,limit:12,keyword:search||undefined}),adminAPI.getCategories()]); setProducts(pRes.data.products||[]); setPagination(pRes.data.pagination||{}); setCategories(cRes.data.categories||[]) } catch {} finally { setLoading(false) }
  }
  useEffect(()=>{ fetchData() },[page,search])
  const handleDelete = async id => { if (!window.confirm("Delete this product?")) return; setDeleting(id); try { await productAPI.delete(id); toast.success("Deleted"); fetchData() } catch(e) { toast.error(e.response?.data?.message||"Delete failed") } finally { setDeleting(null) } }
  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between flex-wrap gap-4"><div><h1 className="font-display text-3xl tracking-wider">Products</h1><p className="text-white/40 text-sm">{pagination.total||0} total</p></div><button onClick={()=>{setEditProduct(null);setShowForm(true)}} className="btn-primary flex items-center gap-2 py-2.5 px-5"><FiPlus size={16}/> Add Product</button></div>
      <div className="relative max-w-sm"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pl-10 py-2.5 text-sm" placeholder="Search products…"/></div>
      {loading ? <Loading/> : (
        <>
          <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="border-b border-white/8">{["Product","Category","Price","Stock","Status",""].map(h=><th key={h} className="text-left px-5 py-3.5 text-xs font-medium tracking-wider uppercase text-white/40">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">{products.map(p=>(
              <tr key={p._id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={p.images?.[0]?.url} alt="" className="w-full h-full object-cover" onError={e=>{e.target.style.display="none"}}/></div><div><p className="font-medium text-sm line-clamp-1">{p.name}</p><p className="text-white/30 text-xs">{p.brand}</p></div></div></td>
                <td className="px-5 py-4 text-sm text-white/50">{p.category?.name||"—"}</td>
                <td className="px-5 py-4"><p className="text-sm font-semibold text-acid">₹{(p.discountPrice||p.price)?.toLocaleString()}</p>{p.discountPrice&&<p className="text-xs text-white/30 line-through">₹{p.price?.toLocaleString()}</p>}</td>
                <td className="px-5 py-4"><span className={`text-sm font-medium ${p.totalStock===0?"text-fire":p.totalStock<=5?"text-yellow-400":"text-acid"}`}>{p.totalStock===0?"Out":p.totalStock}</span>{p.totalStock===0&&<FiAlertTriangle size={12} className="inline ml-1 text-fire"/>}</td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{p.isNew&&<span className="badge-acid text-[10px]">New</span>}{p.isFeatured&&<span className="badge bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px]">Featured</span>}{!p.isActive&&<span className="badge bg-fire/15 text-fire border border-fire/20 text-[10px]">Inactive</span>}</div></td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={()=>{setEditProduct(p);setShowForm(true)}} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-acid/10 hover:text-acid flex items-center justify-center transition-colors"><FiEdit2 size={13}/></button><button onClick={()=>handleDelete(p._id)} disabled={deleting===p._id} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-fire/10 hover:text-fire flex items-center justify-center transition-colors">{deleting===p._id?<span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"/>:<FiTrash2 size={13}/>}</button></div></td>
              </tr>
            ))}</tbody>
          </table>{products.length===0&&<div className="text-center py-16 text-white/30"><p>No products found</p></div>}</div></div>
          {pagination.pages>1 && <div className="flex items-center justify-center gap-2"><button disabled={!pagination.hasPrev} onClick={()=>setPage(p=>p-1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">← Prev</button><span className="text-white/40 text-sm">Page {page} of {pagination.pages}</span><button disabled={!pagination.hasNext} onClick={()=>setPage(p=>p+1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">Next →</button></div>}
        </>
      )}
      <AnimatePresence>{showForm&&<ProductForm product={editProduct} categories={categories} onSave={()=>{setShowForm(false);setEditProduct(null);fetchData()}} onClose={()=>setShowForm(false)}/>}</AnimatePresence>
    </div>
  )
}
