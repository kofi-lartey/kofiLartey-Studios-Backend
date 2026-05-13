import multer from "multer";
import cloudinary from "./cloudinary.js";
import sharp from "sharp";
import pLimit from "p-limit";
import fs from "fs-extra";
import path from "path";

// ===========================================
// CREATE UPLOAD DIRECTORY
// ===========================================

const uploadPath = "./uploads";

fs.ensureDirSync(uploadPath);

// ===========================================
// MULTER DISK STORAGE
// ===========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueName +
        path.extname(file.originalname)
    );
  }
});

// ===========================================
// MULTER CONFIG
// ===========================================

const upload = multer({
  storage,

  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files are allowed"
        ),
        false
      );
    }
  }
});

// ===========================================
// MULTIPLE IMAGE PROCESSOR
// ===========================================

export const processMultipleImagesOptimized =
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return next();
      }

      console.log(
        `🚀 Uploading ${req.files.length} images`
      );

      const limit = pLimit(3);

      const uploadPromises = req.files.map(
        (file, index) =>
          limit(async () => {
            try {
              console.log(
                `📤 Processing image ${
                  index + 1
                }`
              );

              let finalPath = file.path;

              // =====================================
              // COMPRESS ONLY FILES >= 10MB
              // =====================================

              const TEN_MB =
                10 * 1024 * 1024;

              if (file.size >= TEN_MB) {
                console.log(
                  `🗜 Compressing image ${
                    index + 1
                  }`
                );

                const compressedPath =
                  file.path.replace(
                    path.extname(file.path),
                    "-compressed.jpg"
                  );

                await sharp(file.path)
                  .rotate()
                  .resize({
                    width: 2500,
                    withoutEnlargement: true
                  })
                  .jpeg({
                    quality: 80
                  })
                  .toFile(compressedPath);

                finalPath = compressedPath;

                console.log(
                  `✅ Compression complete image ${
                    index + 1
                  }`
                );
              } else {
                console.log(
                  `⚡ Skipping compression image ${
                    index + 1
                  }`
                );
              }

              // =====================================
              // CLOUDINARY UPLOAD
              // =====================================

              const result =
                await cloudinary.uploader.upload(
                  finalPath,
                  {
                    folder:
                      "kofiLarteyStudios_Api/gallery",

                    resource_type:
                      "image",

                    use_filename: false,

                    unique_filename: true,

                    overwrite: false
                  }
                );

              console.log(
                `✅ Uploaded image ${
                  index + 1
                }`
              );

              // =====================================
              // CLEANUP FILES
              // =====================================

              await fs.remove(file.path);

              if (
                finalPath !== file.path
              ) {
                await fs.remove(finalPath);
              }

              return result;
            } catch (error) {
              console.error(
                `❌ Failed image ${
                  index + 1
                }`,
                error
              );

              throw error;
            }
          })
      );

      const results = await Promise.all(
        uploadPromises
      );

      req.cloudinaryResults = results;

      req.uploadMetadata = {
        totalUploaded: results.length,
        concurrency: 3,
        uploadedAt: new Date()
      };

      console.log(
        `✨ Upload complete`
      );

      next();
    } catch (error) {
      console.error(
        "UPLOAD FAILED:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

// ===========================================
// SINGLE IMAGE PROCESSOR
// ===========================================

export const processSingleImageFast =
  async (req, res, next) => {
    try {
      if (!req.file) return next();

      console.log(
        `📤 Uploading single image`
      );

      let finalPath = req.file.path;

      // =====================================
      // COMPRESS IF >= 10MB
      // =====================================

      const TEN_MB = 10 * 1024 * 1024;

      if (req.file.size >= TEN_MB) {
        console.log(
          `🗜 Compressing single image`
        );

        const compressedPath =
          req.file.path.replace(
            path.extname(req.file.path),
            "-compressed.jpg"
          );

        await sharp(req.file.path)
          .rotate()
          .resize({
            width: 2500,
            withoutEnlargement: true
          })
          .jpeg({
            quality: 80
          })
          .toFile(compressedPath);

        finalPath = compressedPath;
      }

      // =====================================
      // CLOUDINARY UPLOAD
      // =====================================

      const result =
        await cloudinary.uploader.upload(
          finalPath,
          {
            folder:
              "kofiLarteyStudios_Api/gallery",

            resource_type: "image",

            use_filename: false,

            unique_filename: true,

            overwrite: false
          }
        );

      console.log(
        `✅ Single image uploaded`
      );

      // =====================================
      // CLEANUP
      // =====================================

      await fs.remove(req.file.path);

      if (finalPath !== req.file.path) {
        await fs.remove(finalPath);
      }

      req.cloudinaryResult = result;

      next();
    } catch (error) {
      console.error(
        "SINGLE UPLOAD FAILED:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

// ===========================================
// PROFILE IMAGE PROCESSOR
// ===========================================

export const processProfileImage =
  async (req, res, next) => {
    try {
      if (!req.file) return next();

      console.log(
        `📤 Uploading profile image`
      );

      let finalPath = req.file.path;

      // =====================================
      // COMPRESS IF >= 10MB
      // =====================================

      const TEN_MB = 10 * 1024 * 1024;

      if (req.file.size >= TEN_MB) {
        console.log(
          `🗜 Compressing profile image`
        );

        const compressedPath =
          req.file.path.replace(
            path.extname(req.file.path),
            "-compressed.jpg"
          );

        await sharp(req.file.path)
          .rotate()
          .resize({
            width: 1000,
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85
          })
          .toFile(compressedPath);

        finalPath = compressedPath;
      }

      // =====================================
      // CLOUDINARY UPLOAD - PROFILE FOLDER
      // =====================================

      const result =
        await cloudinary.uploader.upload(
          finalPath,
          {
            folder:
              "kofiLarteyStudios_Api/profiles",

            resource_type: "image",

            use_filename: false,

            unique_filename: true,

            overwrite: false
          }
        );

      console.log(
        `✅ Profile image uploaded`
      );

      // =====================================
      // CLEANUP
      // =====================================

      await fs.remove(req.file.path);

      if (finalPath !== req.file.path) {
        await fs.remove(finalPath);
      }

      req.cloudinaryResult = result;

      next();
    } catch (error) {
      console.error(
        "PROFILE UPLOAD FAILED:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

// ===========================================
// EXPORT MULTER INITIALIZERS
// ===========================================

export const uploadSingle =
  upload.single("profileImage");

export const uploadSingleGallery =
  upload.single("image");

export const uploadMultiple =
  upload.array("images", 10);

// ===========================================
// CLOUDINARY DELETE
// ===========================================

export const deleteFromCloudinary =
  async (publicId) => {
    try {
      return await cloudinary.uploader.destroy(
        publicId
      );
    } catch (error) {
      console.error(
        "Cloudinary delete error:",
        error
      );

      throw error;
    }
  };

// ===========================================
// DELETE MULTIPLE IMAGES FROM CLOUDINARY
// ===========================================

export const deleteMultipleFromCloudinary =
  async (publicIds) => {
    try {
      const results = await Promise.all(
        publicIds.map(publicId => 
          cloudinary.uploader.destroy(publicId)
        )
      );
      
      console.log(
        `🗑 Deleted ${results.length} images from Cloudinary`
      );
      
      return results;
    } catch (error) {
      console.error(
        "Cloudinary bulk delete error:",
        error
      );
      throw error;
    }
  };

// ===========================================
// UPDATE IMAGE IN CLOUDINARY
// ===========================================

export const updateImageInCloudinary =
  async (publicId, options = {}) => {
    try {
      const {
        newFile,
        transformation,
        tags
      } = options;

      // If new file provided, upload it and delete old
      if (newFile) {
        // Upload new image
        const result =
          await cloudinary.uploader.upload(
            newFile,
            {
              folder:
                "kofiLarteyStudios_Api/gallery",
              resource_type: "image",
              use_filename: true,
              unique_filename: true,
              overwrite: true,
              tags: tags
            }
          );

        // Delete old image
        await cloudinary.uploader.destroy(
          publicId
        );

        console.log(
          `🔄 Updated image: ${publicId} -> ${result.public_id}`
        );

        return result;
      }

      // If only transformation update
      if (transformation) {
        // Cloudinary transformations are applied on delivery
        // No need to re-upload, just return transformed URL info
        const transformedUrl =
          cloudinary.url(publicId, {
            transformation: transformation
          });

        console.log(
          `🔄 Updated transformation for: ${publicId}`
        );

        return {
          public_id: publicId,
          transformedUrl,
          transformation
        };
      }

      throw new Error(
        "No update options provided"
      );
    } catch (error) {
      console.error(
        "Cloudinary update error:",
        error
      );
      throw error;
    }
  };

// ===========================================
// ADD TAGS TO IMAGE
// ===========================================

export const addTagsToImage = async (
  publicId,
  tags
) => {
  try {
    const result = await cloudinary.uploader.add_tag(
      tags,
      [publicId]
    );

    console.log(
      `🏷 Added tags to ${publicId}: ${tags.join(", ")}`
    );

    return result;
  } catch (error) {
    console.error(
      "Add tags error:",
      error
    );
    throw error;
  }
};

// ===========================================
// REMOVE TAGS FROM IMAGE
// ===========================================

export const removeTagsFromImage = async (
  publicId,
  tags
) => {
  try {
    const result = await cloudinary.uploader.remove_tag(
      tags,
      [publicId]
    );

    console.log(
      `🏷 Removed tags from ${publicId}: ${tags.join(", ")}`
    );

    return result;
  } catch (error) {
    console.error(
      "Remove tags error:",
      error
    );
    throw error;
  }
};

// ===========================================
// GET IMAGE DETAILS
// ===========================================

export const getImageDetails = async (
  publicId
) => {
  try {
    const result =
      await cloudinary.api.resource(publicId);

    console.log(
      `📸 Retrieved details for: ${publicId}`
    );

    return {
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      createdAt: result.created_at,
      url: result.secure_url,
      tags: result.tags || []
    };
  } catch (error) {
    console.error(
      "Get image details error:",
      error
    );
    throw error;
  }
};

// ===========================================
// GET GALLERY IMAGES FROM CLOUDINARY
// ===========================================

export const getGalleryImagesFromCloudinary =
  async (folder = "kofiLarteyStudios_Api/gallery", options = {}) => {
    try {
      const { maxResults = 100, nextCursor } = options;

      const result = await cloudinary.api.resources({
        type: "upload",
        prefix: folder,
        max_results: maxResults,
        next_cursor: nextCursor
      });

      console.log(
        `📁 Retrieved ${result.resources.length} images from ${folder}`
      );

      return {
        images: result.resources,
        nextCursor: result.next_cursor,
        total: result.resources.length
      };
    } catch (error) {
      console.error(
        "Get gallery images error:",
        error
      );
      throw error;
    }
  };

// ===========================================
// RENAME IMAGE IN CLOUDINARY
// ===========================================

export const renameImageInCloudinary = async (
  oldPublicId,
  newPublicId
) => {
  try {
    const result = await cloudinary.uploader.rename(
      oldPublicId,
      newPublicId
    );

    console.log(
      `✏️ Renamed: ${oldPublicId} -> ${newPublicId}`
    );

    return result;
  } catch (error) {
    console.error(
      "Rename image error:",
      error
    );
    throw error;
  }
};

// ===========================================
// EXTRACT PUBLIC ID
// ===========================================

export const extractPublicIdFromUrl = (
  url
) => {
  try {
    const regex =
      /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]*)?$/;

    const match = url.match(regex);

    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// ===========================================
// OPTIMIZED DELIVERY URL
// ===========================================

export const getOptimizedImageUrl = (
  publicId,
  options = {}
) => {
  const {
    width,
    height,
    quality = "auto",
    format = "auto"
  } = options;

  return cloudinary.url(publicId, {
    transformation: [
      {
        width,
        height,
        crop: "limit",
        quality,
        fetch_format: format
      }
    ]
  });
};

// ===========================================
// GENERATE THUMBNAIL URL
// ===========================================

export const getThumbnailUrl = (
  publicId,
  width = 300,
  height = 300
) => {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width,
        height,
        crop: "fill",
        gravity: "auto",
        quality: "auto"
      }
    ]
  });
};

// ===========================================
// ADD WATERMARK TO IMAGE
// ===========================================

export const addWatermarkToImage = (
  publicId,
  watermarkPublicId,
  options = {}
) => {
  const {
    position = "south_east",
    opacity = 60,
    width = 100
  } = options;

  return cloudinary.url(publicId, {
    transformation: [
      {
        overlay: watermarkPublicId,
        opacity: opacity,
        gravity: position,
        width: width,
        flags: "relative"
      }
    ]
  });
};

// ===========================================
// MULTER ERROR HANDLER
// ===========================================

export const handleMulterError = (
  err,
  req,
  res,
  next
) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      FILE_TOO_LARGE:
        "File too large. Maximum size is 25MB.",

      LIMIT_FILE_COUNT:
        "Too many files. Maximum is 10.",

      LIMIT_UNEXPECTED_FILE:
        "Unexpected upload field."
    };

    return res.status(400).json({
      success: false,
      message:
        messages[err.code] ||
        err.message
    });
  }

  next(err);
};

// ===========================================
// GET IMAGE PUBLIC ID FROM FULL URL
// ===========================================

export const getPublicIdFromUrl = (url) => {
  try {
    const parts = url.split("/");
    const filename = parts[parts.length - 1];
    const publicId = filename.split(".")[0];
    const folder = parts.slice(parts.length - 3, parts.length - 1).join("/");
    
    return `${folder}/${publicId}`;
  } catch (error) {
    console.error("Get public ID error:", error);
    return null;
  }
};

// ===========================================
// CHECK IF IMAGE EXISTS IN CLOUDINARY
// ===========================================

export const imageExistsInCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return !!result;
  } catch (error) {
    if (error.http_code === 404) {
      return false;
    }
    throw error;
  }
};

export default upload;