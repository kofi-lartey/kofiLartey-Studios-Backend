import { GalleryImages } from "../Model/galleryModal.js";
import { GalleryName } from "../Model/galleryModal.js";
import {
    deleteFromCloudinary,
    extractPublicIdFromUrl,
    getOptimizedImageUrl
} from "../Utiles/uploadFiles.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

/**
 * Upload multiple images to gallery
 * @route POST /api/gallery/:galleryID/images/upload
 * @access Private
 */
export const uploadGalleryImages = async (
  req,
  res
) => {
  const startTime = Date.now();

  try {
    const userId = req.user._id || req.user.id;

    const { galleryID } = req.params;

    const cleanGalleryID = galleryID.trim();

    const galleryName =
      await GalleryName.findOne({
        galleryID: cleanGalleryID
      }).lean();

    if (
      !galleryName ||
      galleryName.userId.toString() !==
        userId.toString()
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Gallery not found or permission denied"
      });
    }

    if (galleryName.galleryStatus === "Expired") {
      return res.status(403).json({
        success: false,
        message:
          "Cannot upload images to expired gallery"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded"
      });
    }

    const cloudinaryResults =
      req.cloudinaryResults;

    if (
      !cloudinaryResults ||
      cloudinaryResults.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No processed images"
      });
    }

    const existingGallery =
      await GalleryImages.findOne({
        galleryID: cleanGalleryID
      })
        .select("totalImages coverImage")
        .lean();

    const currentCount =
      existingGallery?.totalImages || 0;

    const imageDetails =
      cloudinaryResults.map(
        (cloudResult, index) => {
          const originalFile =
            req.files[index];

          return {
            imageId: uuidv4(),

            imageName: path
              .parse(
                originalFile.originalname
              )
              .name.substring(0, 100),

            originalName:
              originalFile.originalname.substring(
                0,
                255
              ),

            imageUrl:
              cloudResult.secure_url,

            size: originalFile.size,

            sizeFormatted: formatBytes(
              originalFile.size
            ),

            mimeType:
              originalFile.mimetype,

            extension: path.parse(
              originalFile.originalname
            ).ext,

            dimensions: {
              width:
                cloudResult.width || null,

              height:
                cloudResult.height || null
            },

            uploadedAt: new Date(),

            order: currentCount + index
          };
        }
      );

    await GalleryImages.updateOne(
      {
        galleryID: cleanGalleryID
      },

      {
        $setOnInsert: {
          userId,
          galleryID: cleanGalleryID,

          coverImage:
            existingGallery?.coverImage ||
            imageDetails[0].imageUrl
        },

        $push: {
          imagesDetails: {
            $each: imageDetails
          }
        },

        $inc: {
          totalImages: imageDetails.length
        },

        $set: {
          lastImageUploadedAt: new Date()
        }
      },

      {
        upsert: true
      }
    );

    if (galleryName.galleryStatus === "Draft") {
      await GalleryName.updateOne(
        {
          galleryID: cleanGalleryID
        },

        {
          $set: {
            galleryStatus: "Active"
          }
        }
      );
    }

    const totalTime = (
      (Date.now() - startTime) /
      1000
    ).toFixed(2);

    res.status(201).json({
      success: true,

      message: `${imageDetails.length} image(s) uploaded successfully`,
      imageDetails: imageDetails,
      processingTime: `${totalTime}s`,

      uploadStats: req.uploadMetadata
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message
    });
  }
};

export const deleteMultipleImages = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        const { imageIds } = req.body; // Array of image IDs

        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of image IDs to delete"
            });
        }

        // Verify ownership
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery images not found"
            });
        }

        const deletedImages = [];
        const cloudinaryDeletions = [];

        // Delete each image
        for (const imageId of imageIds) {
            const imageToDelete = galleryImages.imagesDetails.find(img => img.imageId === imageId);
            
            if (imageToDelete) {
                // Track for Cloudinary deletion
                cloudinaryDeletions.push(extractPublicIdFromUrl(imageToDelete.imageUrl));
                
                // Remove from array
                const imageIndex = galleryImages.imagesDetails.findIndex(img => img.imageId === imageId);
                galleryImages.imagesDetails.splice(imageIndex, 1);
                
                deletedImages.push({
                    imageId: imageId,
                    imageName: imageToDelete.imageName
                });
            }
        }

        // Update gallery counts
        galleryImages.totalImages = galleryImages.imagesDetails.length;
        
        // Update cover image if needed
        if (galleryImages.coverImage && deletedImages.some(img => img.imageUrl === galleryImages.coverImage)) {
            galleryImages.coverImage = galleryImages.imagesDetails.length > 0 
                ? galleryImages.imagesDetails[0].imageUrl 
                : null;
        }
        
        // Update last upload timestamp
        if (galleryImages.imagesDetails.length > 0) {
            galleryImages.lastImageUploadedAt = galleryImages.imagesDetails[galleryImages.imagesDetails.length - 1].uploadedAt;
        } else {
            galleryImages.lastImageUploadedAt = null;
        }
        
        await galleryImages.save();

        // Delete from Cloudinary (don't await, do in background)
        Promise.all(cloudinaryDeletions.filter(id => id).map(publicId => 
            deleteFromCloudinary(publicId).catch(err => console.error(`Failed to delete ${publicId}:`, err))
        ));

        res.status(200).json({
            success: true,
            message: `${deletedImages.length} image(s) deleted successfully`,
            data: {
                deletedCount: deletedImages.length,
                deletedImages: deletedImages,
                totalImagesRemaining: galleryImages.totalImages
            }
        });

    } catch (error) {
        console.error("Delete multiple images error:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting images",
            error: error.message
        });
    }
};


/**
 * Get all images from a gallery
 * @route GET /api/gallery/:galleryID/images
 * @access Private/Public (based on access key)
 */
export const getGalleryImages = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { galleryID } = req.params;
        const { page = 1, limit = 20, isFavorite, tag, optimized = 'true' } = req.query;

        // Check if gallery exists and belongs to user
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        // Check if gallery is expired
        if (galleryName.galleryStatus === "Expired") {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }

        // Get gallery images
        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages || galleryImages.totalImages === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No images found in this gallery",
                pagination: {
                    currentPage: 1,
                    totalPages: 0,
                    totalItems: 0
                }
            });
        }

        let images = [...galleryImages.imagesDetails];

        // Filter by favorite
        if (isFavorite !== undefined) {
            images = images.filter(img => img.isFavorite === (isFavorite === 'true'));
        }

        // Filter by tag
        if (tag) {
            images = images.filter(img => img.tags && img.tags.includes(tag));
        }

        // Sort by order
        images.sort((a, b) => a.order - b.order);

        // Add optimized URLs if requested
        if (optimized === 'true') {
            images = images.map(img => ({
                ...img,
                optimizedThumbnail: getOptimizedImageUrl(extractPublicIdFromUrl(img.imageUrl), { width: 300, quality: 70 }),
                optimizedMedium: getOptimizedImageUrl(extractPublicIdFromUrl(img.imageUrl), { width: 800, quality: 80 }),
                optimizedLarge: getOptimizedImageUrl(extractPublicIdFromUrl(img.imageUrl), { width: 1600, quality: 85 })
            }));
        }

        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedImages = images.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedImages,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(images.length / limitNum),
                totalItems: images.length,
                itemsPerPage: limitNum
            },
            galleryInfo: {
                galleryName: galleryName.galleryName,
                galleryStatus: galleryName.galleryStatus,
                coverImage: galleryImages.coverImage,
                totalImages: galleryImages.totalImages
            }
        });

    } catch (error) {
        console.error("Get gallery images error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery images",
            error: error.message
        });
    }
};

/**
 * Get single image by ID
 * @route GET /api/gallery/:galleryID/images/:imageId
 * @access Private/Public
 */
export const getImageById = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { galleryID, imageId } = req.params;
        const { optimized = 'true' } = req.query;

        const galleryImages = await GalleryImages.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        let image = galleryImages.imagesDetails.find(img => img.imageId === imageId);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Image not found"
            });
        }

        // Add optimized URLs if requested
        if (optimized === 'true') {
            const publicId = extractPublicIdFromUrl(image.imageUrl);
            image = {
                ...image.toObject(),
                optimizedThumbnail: getOptimizedImageUrl(publicId, { width: 300, quality: 70 }),
                optimizedMedium: getOptimizedImageUrl(publicId, { width: 800, quality: 80 }),
                optimizedLarge: getOptimizedImageUrl(publicId, { width: 1600, quality: 85 }),
                optimizedOriginal: getOptimizedImageUrl(publicId, { quality: 90 })
            };
        }

        res.status(200).json({
            success: true,
            data: image
        });

    } catch (error) {
        console.error("Get image error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching image",
            error: error.message
        });
    }
};

/**
 * Update image details
 * @route PUT /api/gallery/:galleryID/images/:imageId
 * @access Private
 */
export const updateImageDetails = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { galleryID, imageId } = req.params;
        const updateData = req.body;

        // Verify ownership
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery images not found"
            });
        }

        // Allowed fields to update
        const allowedUpdates = [
            "imageName", "tags", "isFavorite", "description", "order",
            "iso", "aperture", "shutterSpeed", "cameraModel", "dateTaken"
        ];

        const filteredUpdate = {};
        allowedUpdates.forEach(field => {
            if (updateData[field] !== undefined) {
                filteredUpdate[field] = updateData[field];
            }
        });

        const updatedImage = await galleryImages.updateImageDetails(imageId, filteredUpdate);

        if (!updatedImage) {
            return res.status(404).json({
                success: false,
                message: "Image not found"
            });
        }

        const updatedImageData = galleryImages.imagesDetails.find(img => img.imageId === imageId);

        res.status(200).json({
            success: true,
            message: "Image updated successfully",
            data: updatedImageData
        });

    } catch (error) {
        console.error("Update image error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating image",
            error: error.message
        });
    }
};

/**
 * Delete image from gallery
 * @route DELETE /api/gallery/:galleryID/images/:imageId
 * @access Private
 */
export const deleteImage = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }
        
        const { galleryID, imageId } = req.params;

        // Verify ownership
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery images not found"
            });
        }

        // Find the image to delete
        const imageToDelete = galleryImages.imagesDetails.find(img => img.imageId === imageId);

        if (!imageToDelete) {
            return res.status(404).json({
                success: false,
                message: "Image not found"
            });
        }

        // Remove image from imagesDetails array
        const imageIndex = galleryImages.imagesDetails.findIndex(img => img.imageId === imageId);
        
        if (imageIndex !== -1) {
            // Remove from array
            galleryImages.imagesDetails.splice(imageIndex, 1);
            
            // Update total count
            galleryImages.totalImages = galleryImages.imagesDetails.length;
            
            // Update cover image if the deleted image was the cover
            if (galleryImages.coverImage === imageToDelete.imageUrl) {
                galleryImages.coverImage = galleryImages.imagesDetails.length > 0 
                    ? galleryImages.imagesDetails[0].imageUrl 
                    : null;
            }
            
            // Update last upload timestamp
            if (galleryImages.imagesDetails.length > 0) {
                galleryImages.lastImageUploadedAt = galleryImages.imagesDetails[galleryImages.imagesDetails.length - 1].uploadedAt;
            } else {
                galleryImages.lastImageUploadedAt = null;
            }
            
            // Save the updated document
            await galleryImages.save();
        }

        // Delete from Cloudinary
        try {
            const publicId = extractPublicIdFromUrl(imageToDelete.imageUrl);
            if (publicId) {
                const deletionResult = await deleteFromCloudinary(publicId);
                if (deletionResult.result === 'ok') {
                    console.log(`✅ Deleted from Cloudinary: ${publicId}`);
                } else {
                    console.warn(`Cloudinary deletion warning: ${deletionResult.result}`);
                }
            }
        } catch (cloudError) {
            console.error("Cloudinary deletion error:", cloudError);
            // Don't fail the request if Cloudinary deletion fails
        }

        res.status(200).json({
            success: true,
            message: "Image deleted successfully",
            data: {
                imageId: imageId,
                imageName: imageToDelete.imageName,
                imageUrl: imageToDelete.imageUrl,
                totalImagesRemaining: galleryImages.totalImages,
                deletedAt: new Date()
            }
        });

    } catch (error) {
        console.error("Delete image error:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting image",
            error: error.message
        });
    }
};


/**
 * Reorder images in gallery
 * @route POST /api/gallery/:galleryID/images/reorder
 * @access Private
 */
export const reorderImages = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { galleryID } = req.params;
        const { imageIdsInOrder } = req.body;

        if (!imageIdsInOrder || imageIdsInOrder.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Image order array is required"
            });
        }

        // Verify ownership
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery images not found"
            });
        }

        await galleryImages.reorderImages(imageIdsInOrder);

        res.status(200).json({
            success: true,
            message: "Images reordered successfully",
            data: {
                galleryID: galleryID,
                totalImages: galleryImages.totalImages,
                newOrder: imageIdsInOrder
            }
        });

    } catch (error) {
        console.error("Reorder images error:", error);
        res.status(500).json({
            success: false,
            message: "Error reordering images",
            error: error.message
        });
    }
};

/**
 * Set cover image for gallery
 * @route POST /api/gallery/:galleryID/images/set-cover
 * @access Private
 */
export const setCoverImage = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { galleryID } = req.params;
        const { imageId } = req.body;

        if (!imageId) {
            return res.status(400).json({
                success: false,
                message: "Image ID is required"
            });
        }

        // Verify ownership
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery images not found"
            });
        }

        const image = galleryImages.imagesDetails.find(img => img.imageId === imageId);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Image not found"
            });
        }

        galleryImages.coverImage = image.imageUrl;
        await galleryImages.save();

        // Generate optimized cover URL
        const optimizedCover = getOptimizedImageUrl(extractPublicIdFromUrl(image.imageUrl), { width: 600, quality: 80 });

        res.status(200).json({
            success: true,
            message: "Cover image set successfully",
            data: {
                coverImage: galleryImages.coverImage,
                optimizedCover: optimizedCover,
                imageId: imageId,
                imageName: image.imageName
            }
        });

    } catch (error) {
        console.error("Set cover image error:", error);
        res.status(500).json({
            success: false,
            message: "Error setting cover image",
            error: error.message
        });
    }
};

/**
 * Bulk update images (favorite, tags, etc.)
 * @route POST /api/gallery/:galleryID/images/bulk-update
 * @access Private
 */
export const bulkUpdateImages = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { galleryID } = req.params;
        const { imageIds, updateData } = req.body;

        if (!imageIds || imageIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Image IDs array is required"
            });
        }

        if (!updateData || Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Update data is required"
            });
        }

        // Verify ownership
        const galleryName = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryImages = await GalleryImages.findOne({ galleryID: galleryID });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Gallery images not found"
            });
        }

        const updatedImages = [];

        for (const imageId of imageIds) {
            const image = galleryImages.imagesDetails.find(img => img.imageId === imageId);
            if (image) {
                Object.assign(image, updateData);
                updatedImages.push({
                    imageId: imageId,
                    imageName: image.imageName,
                    updated: true
                });
            }
        }

        await galleryImages.save();

        res.status(200).json({
            success: true,
            message: `${updatedImages.length} images updated successfully`,
            data: {
                updatedCount: updatedImages.length,
                updatedImages: updatedImages,
                updateData: updateData
            }
        });

    } catch (error) {
        console.error("Bulk update error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating images",
            error: error.message
        });
    }
};

/**
 * Get optimized image URL
 * @route GET /api/gallery/optimize/:imageId
 * @access Public
 */
export const getOptimizedImage = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            })
        }
        const { imageId } = req.params;
        const { width, height, quality = 80 } = req.query;

        // Find the image in any gallery
        const galleryImages = await GalleryImages.findOne({
            "imagesDetails.imageId": imageId,
            userId: userId
        });

        if (!galleryImages) {
            return res.status(404).json({
                success: false,
                message: "Image not found"
            });
        }

        const image = galleryImages.imagesDetails.find(img => img.imageId === imageId);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Image not found"
            });
        }

        const publicId = extractPublicIdFromUrl(image.imageUrl);
        const optimizedUrl = getOptimizedImageUrl(publicId, {
            width: width ? parseInt(width) : undefined,
            height: height ? parseInt(height) : undefined,
            quality: parseInt(quality)
        });

        res.status(200).json({
            success: true,
            data: {
                originalUrl: image.imageUrl,
                optimizedUrl: optimizedUrl,
                params: { width, height, quality }
            }
        });

    } catch (error) {
        console.error("Get optimized image error:", error);
        res.status(500).json({
            success: false,
            message: "Error generating optimized URL",
            error: error.message
        });
    }
};

// Helper function to format bytes
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
