const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const isRealImage = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (isRiff && isWebp) return true;
  return false;
};

exports.upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (_, file, cb) => { 
    const extOk = /^\.(jpeg|jpg|png|webp)$/i.test(path.extname(file.originalname)); 
    const mimeOk = /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true); 
    } else {
      cb(new Error("Images only (JPEG, PNG, WEBP)"), false);
    }
  } 
});

exports.uploadToCloudinary = (buffer, folder="lyvo") => new Promise((res, rej) => { 
  if (!isRealImage(buffer)) {
    return rej(Object.assign(new Error("Upload aborted: Invalid image binary signature"), { statusCode: 400 }));
  }
  cloudinary.uploader.upload_stream({ folder, resource_type: "image", quality: "auto" }, (err, result) => {
    if (err) return rej(err);
    res({ url: result.secure_url, publicId: result.public_id });
  }).end(buffer); 
});

exports.deleteFromCloudinary = async (publicId) => { if (publicId) await cloudinary.uploader.destroy(publicId); };
