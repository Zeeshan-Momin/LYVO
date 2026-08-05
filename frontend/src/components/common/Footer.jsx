import { Link } from "react-router-dom"
import { FiInstagram, FiTwitter, FiYoutube } from "react-icons/fi"
export default function Footer() {
  return (
    <footer className="bg-dark-800 border-t border-white/5 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center mb-4">
              <img src="/logo.png" alt="LYVO" className="h-9 w-auto object-contain dark:invert-0 invert" />
            </div>
            <p className="text-white/40 text-sm leading-relaxed mb-5">Live Your Vision Out. Premium sneakers for those who hustle, rise, and keep walking.</p>
            <div className="flex gap-3">
              {[
                { Icon: FiInstagram, url: "https://instagram.com/lyvo.kicks" },
                { Icon: FiTwitter, url: "https://x.com/lyvo_kicks" },
                { Icon: FiYoutube, url: "https://youtube.com" }
              ].map(({ Icon, url }, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:border-acid hover:text-acid transition-all">
                  <Icon size={16}/>
                </a>
              ))}
            </div>
          </div>
          {[
            {title:"Shop",links:[["/products","All Products"],["/products?isNew=true","New Arrivals"],["/products?isFeatured=true","Featured"]]},
            {title:"Support",links:[["/info/size-guide","Size Guide"],["/info/shipping","Shipping"],["/info/returns","Returns"],["/info/track-order","Track Order"]]},
            {title:"Company",links:[["/info/about","About LYVO"],["/info/our-story","Our Story"],["/info/careers","Careers"]]},
          ].map(col=>(
            <div key={col.title}><h3 className="font-semibold text-sm tracking-widest uppercase mb-5">{col.title}</h3><ul className="space-y-2.5">{col.links.map(([to,l])=><li key={l}><Link to={to} className="text-sm text-white/40 hover:text-acid transition-colors">{l}</Link></li>)}</ul></div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">© 2026 LYVO. All rights reserved.</p>
          <div className="flex gap-5">
            {[["Privacy Policy","/info/privacy"],["Terms","/info/terms"],["Cookies","/info/cookies"]].map(([t,to]) => (
              <Link key={t} to={to} className="text-xs text-white/25 hover:text-acid transition-colors">{t}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
