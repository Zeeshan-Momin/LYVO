export const getOptimizedImageUrl = (url, width = 500) => {
  if (!url) return "";
  if (url.includes("res.cloudinary.com")) {
    // Inject auto-format, auto-quality, and custom width parameters into Cloudinary uploads
    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
  }
  if (url.includes("images.unsplash.com")) {
    // Append auto-format, quality, and custom width parameters to Unsplash links
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}auto=format&q=80&w=${width}`;
  }
  return url;
};
