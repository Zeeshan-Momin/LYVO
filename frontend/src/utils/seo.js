export const updateSEO = ({ title, description, url, image }) => {
  document.title = title ? `${title} | LYVO` : "LYVO — Premium Luxury Streetwear";
  
  const updateMeta = (name, content) => {
    let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      if (name.startsWith("og:") || name.startsWith("twitter:")) {
        el.setAttribute("property", name);
      } else {
        el.setAttribute("name", name);
      }
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };
  
  if (description) {
    updateMeta("description", description);
    updateMeta("og:description", description);
    updateMeta("twitter:description", description);
  }
  
  updateMeta("og:title", title || "LYVO — Premium Luxury Streetwear");
  updateMeta("twitter:title", title || "LYVO — Premium Luxury Streetwear");
  
  if (url) {
    updateMeta("og:url", url);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }
  
  if (image) {
    updateMeta("og:image", image);
    updateMeta("twitter:image", image);
  }
};
