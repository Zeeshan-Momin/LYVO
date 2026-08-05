export default function Loading({ fullscreen=false, size="md" }) {
  const sizes={sm:"w-5 h-5",md:"w-8 h-8",lg:"w-12 h-12"}
  const spinner=<div className="flex flex-col items-center gap-3"><div className={`${sizes[size]} border-2 border-white/10 border-t-acid rounded-full animate-spin`}/>{fullscreen&&<span className="font-mono text-xs tracking-widest text-white/30 uppercase">Loading…</span>}</div>
  if (fullscreen) return <div className="fixed inset-0 bg-dark-900 flex items-center justify-center z-50"><div className="text-center"><div className="font-display text-5xl tracking-widest text-acid mb-6 animate-pulse">LYVO</div>{spinner}</div></div>
  return <div className="flex items-center justify-center py-12">{spinner}</div>
}
export function SkeletonCard() {
  return <div className="card overflow-hidden animate-pulse"><div className="aspect-product bg-dark-600"/><div className="p-4 space-y-3"><div className="h-4 bg-dark-600 rounded w-3/4"/><div className="h-3 bg-dark-600 rounded w-1/2"/><div className="h-5 bg-dark-600 rounded w-1/3"/></div></div>
}
