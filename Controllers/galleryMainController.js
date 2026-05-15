import { FRONTEND_URL } from "../Config/env.js";
import { Gallery } from "../Model/galleryModal.js";
import { GalleryName } from "../Model/galleryModal.js";
import { GalleryImages } from "../Model/galleryModal.js";
import { GalleryAccessKey } from "../Model/galleryModal.js";
import {
    createGallerySchema,
    updateGallerySchema
} from "../Scheme/gallerySchema.js";
import mongoose from "mongoose";
import { calculateExpirationDate, generateAccessKey } from "../Utiles/additionals.js";
import { extractPublicIdFromUrl, deleteFromCloudinary } from "../Utiles/uploadFiles.js";

/**
 * Create a new gallery (main configuration)
 * @route POST /api/gallery/main
 * @access Private
 */

export const createGallery = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        const { error, value } = createGallerySchema.validate(req.body, {
            abortEarly: false
        });

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(detail => ({ field: detail.path[0], message: detail.message }))
            });
        }

        const {
            galleryID,
            name,
            email,
            studioName,
            expirationPeriod = "Never Expire",
            downloadPermission = false,
            gallerySettings = {},
            metadata = {}
        } = value;

        // 1. Fetch the Gallery Name document
        const galleryNameDoc = await GalleryName.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!galleryNameDoc) {
            return res.status(404).json({
                success: false,
                message: "Gallery name not found. Please create gallery name first."
            });
        }

        // 2. Fetch the actual images from the GalleryImages model
        const galleryImagesDoc = await GalleryImages.findOne({
            galleryID: galleryID,
            userId: userId
        });

        const existingGallery = await Gallery.findOne({ galleryID: galleryID });
        if (existingGallery) {
            return res.status(400).json({
                success: false,
                message: "Gallery configuration already exists for this gallery ID"
            });
        }

        const accessKey = generateAccessKey();
        const expiresAt = calculateExpirationDate(expirationPeriod);
        const galleryURL = `${FRONTEND_URL}/clientGallery/${galleryID}`;

        // 3. Map the images from the GalleryImages document if they exist
        const imageURLs = galleryImagesDoc && galleryImagesDoc.imagesDetails
            ? galleryImagesDoc.imagesDetails.map(img => ({
                imageId: img.imageId,
                url: img.imageUrl, // matches imageDetailSchema field name
                imageName: img.imageName,
                originalName: img.originalName,
                size: img.size,
                mimeType: img.mimeType,
                uploadedAt: img.uploadedAt
            }))
            : [];

        const newGallery = new Gallery({
            userId: userId,
            galleryID: galleryID,
            galleryName: galleryNameDoc.galleryName, // Adding the name from the name doc
            name: name,
            email: email.toLowerCase(),
            studioName: studioName,
            expirationPeriod: expirationPeriod,
            expiresAt: expiresAt,
            downloadPermission: downloadPermission,
            accessKey: accessKey,
            galleryURL: galleryURL,
            images: imageURLs,
            totalImages: imageURLs.length,
            gallerySettings: {
                allowDownloads: gallerySettings.allowDownloads || false,
                allowWatermark: gallerySettings.allowWatermark || false,
                themeColor: gallerySettings.themeColor || "#000000",
                allowSocialShare: gallerySettings.allowSocialShare ?? true,
                requireAccessKey: gallerySettings.requireAccessKey ?? true,
            },
            metadata: {
                clientNotes: metadata.clientNotes || null,
                tags: metadata.tags || [],
            },
        });

        await newGallery.save();

        if (galleryNameDoc.galleryStatus === "Draft") {
            galleryNameDoc.galleryStatus = "Active";
            await galleryNameDoc.save();
        }

        res.status(201).json({
            success: true,
            message: "Gallery created successfully",
            data: newGallery.toObject()
        });

    } catch (error) {
        console.error("Create gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error creating gallery",
            error: error.message
        });
    }
};

// Add this new endpoint to validate gallery access

// In galleryController.js

export const validateGalleryAccess = async (req, res) => {
    try {
        const { galleryID } = req.params;
        const { accessKey } = req.query;

        console.log("🔍 Received galleryID:", galleryID, "accessKey:", accessKey);

        // Validate input
        if (!accessKey || accessKey.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Access key is required"
            });
        }

        // Find gallery by accessKey
        const gallery = await Gallery.findOne({
            accessKey: accessKey.trim(),
            isDeleted: false
        }).lean();

        console.log("📦 Gallery found:", gallery ? "YES" : "NO");

        // Gallery not found
        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Invalid gallery access key"
            });
        }

        // Check expiration
        if (
            gallery.expiresAt &&
            new Date(gallery.expiresAt) < new Date()
        ) {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }

        // Update metadata
        await Gallery.updateOne(
            { _id: gallery._id },
            {
                $inc: {
                    "metadata.totalViews": 1
                },
                $set: {
                    "metadata.lastViewedAt": new Date()
                }
            }
        );

        // Response
        return res.status(200).json({
            success: true,
            message: "Gallery access granted",
            data: {
                galleryID: gallery.galleryID,
                galleryName: gallery.galleryName,
                studioName: gallery.studioName,
                clientName: gallery.name,
                clientEmail: gallery.email,

                downloadPermission:
                    gallery.downloadPermission || false,

                expirationPeriod:
                    gallery.expirationPeriod || "Never Expire",

                expiresAt: gallery.expiresAt || null,

                totalImages:
                    gallery.totalImages ||
                    gallery.images?.length ||
                    0,

                images: (gallery.images || []).map((img) => ({
                    imageId: img.imageId,
                    url: img.url,
                    imageName: img.imageName || "Image",
                    originalName:
                        img.originalName || "image.jpg",
                    size: img.size || 0,
                    sizeFormatted: img.size
                        ? `${(img.size / 1024 / 1024).toFixed(2)} MB`
                        : "0 MB",
                    mimeType: img.mimeType || "image/jpeg",
                    uploadedAt: img.uploadedAt || new Date()
                })),

                gallerySettings: {
                    allowDownloads:
                        gallery.gallerySettings?.allowDownloads ??
                        gallery.downloadPermission ??
                        false,

                    allowWatermark:
                        gallery.gallerySettings?.allowWatermark ??
                        false,

                    themeColor:
                        gallery.gallerySettings?.themeColor ??
                        "#FF6B6B",

                    allowSocialShare:
                        gallery.gallerySettings?.allowSocialShare ??
                        true,

                    requireAccessKey:
                        gallery.gallerySettings?.requireAccessKey ??
                        true
                }
            }
        });

    } catch (error) {
        console.error(
            "❌ Gallery access validation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Error validating gallery access",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined
        });
    }
};

// Add endpoint to get gallery images
export const getGalleryImages = async (req, res) => {
    try {
        const { galleryId } = req.params;
        const { accessKey } = req.query;

        if (!accessKey) {
            return res.status(400).json({
                success: false,
                message: "Access key is required"
            });
        }

        // Find and validate gallery
        const gallery = await Gallery.findOne({
            galleryID: galleryId,
            isDeleted: false
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        // Validate access key
        if (gallery.accessKey !== accessKey) {
            return res.status(401).json({
                success: false,
                message: "Invalid access key"
            });
        }

        // Get images (adjust based on your image model)
        const Image = mongoose.model('Image'); // or import your Image model
        const images = await Image.find({
            galleryID: galleryId,
            isDeleted: false
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                gallery: {
                    name: gallery.name,
                    studioName: gallery.studioName,
                    gallerySettings: gallery.gallerySettings,
                    downloadPermission: gallery.downloadPermission
                },
                images: images.map(img => ({
                    id: img._id,
                    url: img.url,
                    name: img.name,
                    size: img.size,
                    uploadedAt: img.createdAt
                })),
                totalImages: images.length
            }
        });

    } catch (error) {
        console.error("Get gallery images error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery images"
        });
    }
};

/**
 * Get all galleries for authenticated user
 * @route GET /api/gallery/main
 * @access Private
 */
export const getAllGalleries = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc",
            status,
            search
        } = req.query;

        const query = {
            userId: userId,
            isDeleted: false
        };

        // Filter by status (active/expired)
        if (status === "active") {
            query.$or = [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ];
        } else if (status === "expired") {
            query.expiresAt = { $lt: new Date() };
        }

        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { studioName: { $regex: search, $options: "i" } },
                { galleryID: { $regex: search, $options: "i" } }
            ];
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [galleries, total] = await Promise.all([
            Gallery.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .populate('userId', 'name email')
                .select("-__v"),
            Gallery.countDocuments(query)
        ]);

        // Add additional info to each gallery
        const galleriesWithInfo = await Promise.all(
            galleries.map(async (gallery) => {
                const imagesDoc = await GalleryImages.findOne({ galleryID: gallery.galleryID });
                const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: gallery.galleryID });

                return {
                    ...gallery.toObject(),
                    calculatedStatus: gallery.calculatedStatus,
                    totalImages: imagesDoc?.totalImages || 0,
                    coverImage: imagesDoc?.coverImage || null,
                    hasAccessKey: !!accessKeyDoc,
                    isAccessKeyActive: accessKeyDoc?.isActive || false
                };
            })
        );

        res.status(200).json({
            success: true,
            data: galleriesWithInfo,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                totalItems: total,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(total / limitNum),
                hasPrevPage: pageNum > 1
            }
        });

    } catch (error) {
        console.error("Get all galleries error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching galleries",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Get single gallery by ID or galleryID
 * @route GET /api/gallery/main/:identifier
 * @access Private
 */
export const getGalleryById = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { identifier } = req.params;

        // Check if identifier is MongoDB ObjectId or galleryID
        const isObjectId = mongoose.Types.ObjectId.isValid(identifier);

        const query = {
            userId: userId,
            isDeleted: false
        };

        if (isObjectId) {
            query._id = identifier;
        } else {
            query.galleryID = identifier;
        }

        const gallery = await Gallery.findOne(query)
            .populate('userId', 'name email')
            .select("-__v");

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        // Get additional info from other collections
        const [imagesDoc, accessKeyDoc, galleryNameDoc] = await Promise.all([
            GalleryImages.findOne({ galleryID: gallery.galleryID }),
            GalleryAccessKey.findOne({ galleryID: gallery.galleryID }),
            GalleryName.findOne({ galleryID: gallery.galleryID })
        ]);

        const galleryData = {
            ...gallery.toObject(),
            calculatedStatus: gallery.calculatedStatus,
            totalImages: imagesDoc?.totalImages || 0,
            coverImage: imagesDoc?.coverImage || null,
            imagesDetails: imagesDoc?.imagesDetails || [],
            accessKey: accessKeyDoc?.accessKey || null,
            isAccessKeyActive: accessKeyDoc?.isActive || false,
            accessCount: accessKeyDoc?.accessCount || 0,
            galleryNameStatus: galleryNameDoc?.galleryStatus || "Unknown"
        };

        res.status(200).json({
            success: true,
            data: galleryData
        });

    } catch (error) {
        console.error("Get gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Update gallery configuration
 * @route PUT /api/gallery/main/:id
 * @access Private
 */
export const updateGallery = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        // Validate request body
        const { error, value } = updateGallerySchema.validate(req.body, {
            abortEarly: false
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path[0],
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors
            });
        }

        // Find gallery and verify ownership
        const gallery = await Gallery.findOne({
            _id: id,
            userId: userId,
            isDeleted: false
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        // Apply updates
        if (value.name) gallery.name = value.name;
        if (value.email) gallery.email = value.email.toLowerCase();
        if (value.studioName) gallery.studioName = value.studioName;
        if (value.expirationPeriod) gallery.expirationPeriod = value.expirationPeriod;
        if (value.downloadPermission !== undefined) gallery.downloadPermission = value.downloadPermission;

        // Update gallery settings
        if (value.gallerySettings) {
            Object.assign(gallery.gallerySettings, value.gallerySettings);
        }

        // Update metadata
        if (value.metadata) {
            if (value.metadata.clientNotes !== undefined) {
                gallery.metadata.clientNotes = value.metadata.clientNotes;
            }
            if (value.metadata.tags) {
                gallery.metadata.tags = value.metadata.tags;
            }
        }

        await gallery.save();

        res.status(200).json({
            success: true,
            message: "Gallery updated successfully",
            data: {
                id: gallery._id,
                galleryID: gallery.galleryID,
                name: gallery.name,
                email: gallery.email,
                studioName: gallery.studioName,
                expirationPeriod: gallery.expirationPeriod,
                expiresAt: gallery.expiresAt,
                downloadPermission: gallery.downloadPermission,
                gallerySettings: gallery.gallerySettings,
                metadata: gallery.metadata,
                updatedAt: gallery.updatedAt
            }
        });

    } catch (error) {
        console.error("Update gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating gallery",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Soft delete gallery
 * @route DELETE /api/gallery/main/:id
 * @access Private
 */
// controllers/galleryController.js

export const deleteGallery = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        // Find the gallery
        const gallery = await Gallery.findOne({
            _id: id,
            userId: userId
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found or you don't have permission"
            });
        }

        const galleryID = gallery.galleryID;

        // Get image URLs from both collections for Cloudinary cleanup
        const [galleryImages, clientGallery] = await Promise.all([
            GalleryImages.findOne({ galleryID: galleryID }).select('imagesDetails.imageUrl').lean(),
            Gallery.findOne({ _id: id }).select('images.url').lean()
        ]);

        // Collect unique Cloudinary public IDs
        const cloudinaryIds = new Set();

        galleryImages?.imagesDetails?.forEach(img => {
            const publicId = extractPublicIdFromUrl(img.imageUrl);
            if (publicId) cloudinaryIds.add(publicId);
        });

        clientGallery?.images?.forEach(img => {
            const publicId = extractPublicIdFromUrl(img.url);
            if (publicId) cloudinaryIds.add(publicId);
        });

        // Delete everything from database
        await Promise.all([
            Gallery.deleteOne({ _id: id }),
            GalleryImages.deleteOne({ galleryID: galleryID }),
            GalleryAccessKey.deleteOne({ galleryID: galleryID }),
            GalleryName.findOneAndUpdate(
                { galleryID: galleryID },
                { galleryStatus: "Deleted" }
            )
        ]);

        // Delete from Cloudinary (background)
        if (cloudinaryIds.size > 0) {
            Promise.allSettled(
                Array.from(cloudinaryIds).map(id => deleteFromCloudinary(id))
            ).then(results => {
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                console.log(`☁️ Cloudinary: ${succeeded}/${results.length} images deleted`);
            });
        }

        console.log(`🗑️ Gallery ${galleryID} permanently deleted`);

        res.status(200).json({
            success: true,
            message: "Gallery permanently deleted",
            data: {
                galleryID: galleryID,
                imagesDeleted: cloudinaryIds.size,
                deletedAt: new Date()
            }
        });

    } catch (error) {
        console.error("Delete gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting gallery",
            error: error.message
        });
    }
};

/**
 * Restore soft deleted gallery
 * @route POST /api/gallery/main/:id/restore
 * @access Private
 */
export const restoreGallery = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;

        const gallery = await Gallery.findOne({
            _id: id,
            userId: userId,
            isDeleted: true
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Deleted gallery not found"
            });
        }

        await gallery.restore();

        // Update gallery name status
        await GalleryName.findOneAndUpdate(
            { galleryID: gallery.galleryID },
            { galleryStatus: "Active" }
        );

        res.status(200).json({
            success: true,
            message: "Gallery restored successfully",
            data: {
                galleryID: gallery.galleryID,
                isDeleted: false,
                restoredAt: new Date()
            }
        });

    } catch (error) {
        console.error("Restore gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error restoring gallery",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Increment gallery view count
 * @route POST /api/gallery/main/:galleryID/view
 * @access Public
 */
export const incrementGalleryViews = async (req, res) => {
    try {
        const { galleryID } = req.params;

        const gallery = await Gallery.findOne({
            galleryID: galleryID,
            isDeleted: false
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        // Check if expired
        if (gallery.expiresAt && gallery.expiresAt < new Date()) {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }

        await gallery.incrementViews();

        res.status(200).json({
            success: true,
            message: "View count incremented",
            data: {
                totalViews: gallery.metadata.totalViews,
                lastViewedAt: gallery.metadata.lastViewedAt
            }
        });

    } catch (error) {
        console.error("Increment views error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating view count",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Increment gallery download count
 * @route POST /api/gallery/main/:galleryID/download
 * @access Public
 */
export const incrementGalleryDownloads = async (req, res) => {
    try {
        const { galleryID } = req.params;
        const { count = 1 } = req.body;

        const gallery = await Gallery.findOne({
            galleryID: galleryID,
            isDeleted: false
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        // Check if expired
        if (gallery.expiresAt && gallery.expiresAt < new Date()) {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }

        // Check if downloads are allowed
        if (!gallery.downloadPermission && !gallery.gallerySettings.allowDownloads) {
            return res.status(403).json({
                success: false,
                message: "Downloads are not allowed for this gallery"
            });
        }

        await gallery.incrementDownloads(count);

        res.status(200).json({
            success: true,
            message: "Download count updated",
            data: {
                totalDownloads: gallery.metadata.totalDownloads
            }
        });

    } catch (error) {
        console.error("Increment downloads error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating download count",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Get gallery statistics
 * @route GET /api/gallery/main/:galleryID/stats
 * @access Private
 */
export const getGalleryStats = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;

        const gallery = await Gallery.findOne({
            galleryID: galleryID,
            userId: userId
        });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        const [imagesDoc, accessKeyDoc] = await Promise.all([
            GalleryImages.findOne({ galleryID: gallery.galleryID }),
            GalleryAccessKey.findOne({ galleryID: gallery.galleryID })
        ]);

        // Calculate additional stats
        const totalImageSize = imagesDoc?.imagesDetails.reduce((sum, img) => sum + (img.size || 0), 0) || 0;
        const averageImageSize = imagesDoc?.imagesDetails.length > 0
            ? totalImageSize / imagesDoc.imagesDetails.length
            : 0;

        // Get tag statistics
        const allTags = imagesDoc?.imagesDetails.flatMap(img => img.tags || []) || [];
        const tagCount = {};
        allTags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });

        const topTags = Object.entries(tagCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));

        res.status(200).json({
            success: true,
            data: {
                galleryInfo: {
                    galleryID: gallery.galleryID,
                    name: gallery.name,
                    studioName: gallery.studioName,
                    status: gallery.calculatedStatus,
                    createdAt: gallery.createdAt,
                    expiresAt: gallery.expiresAt
                },
                imageStats: {
                    totalImages: imagesDoc?.totalImages || 0,
                    totalSize: formatBytes(totalImageSize),
                    averageSize: formatBytes(averageImageSize),
                    coverImage: imagesDoc?.coverImage || null,
                    favoriteCount: imagesDoc?.imagesDetails.filter(img => img.isFavorite).length || 0
                },
                accessStats: {
                    totalViews: gallery.metadata.totalViews,
                    totalDownloads: gallery.metadata.totalDownloads,
                    lastViewedAt: gallery.metadata.lastViewedAt,
                    accessKeyActive: accessKeyDoc?.isActive || false,
                    totalAccessKeyUses: accessKeyDoc?.accessCount || 0
                },
                tagStats: {
                    totalUniqueTags: Object.keys(tagCount).length,
                    topTags: topTags
                },
                engagement: {
                    hasImages: (imagesDoc?.totalImages || 0) > 0,
                    hasAccessKey: !!accessKeyDoc,
                    isPublic: !gallery.gallerySettings.requireAccessKey,
                    allowDownloads: gallery.downloadPermission || gallery.gallerySettings.allowDownloads
                }
            }
        });

    } catch (error) {
        console.error("Get gallery stats error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery statistics",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

export const getGalleryAllStats = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        // Get all galleries for this user
        const galleries = await Gallery.find({
            userId: userId,
            isDeleted: false
        }).lean();

        if (!galleries || galleries.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No galleries found for this user"
            });
        }

        // Get all galleryIDs
        const galleryIDs = galleries.map(g => g.galleryID);

        // Fetch all GalleryImages and GalleryAccessKeys in parallel
        const [allImagesDocs, allAccessKeyDocs, allGalleryNames] = await Promise.all([
            GalleryImages.find({ galleryID: { $in: galleryIDs } }).lean(),
            GalleryAccessKey.find({ galleryID: { $in: galleryIDs } }).lean(),
            GalleryName.find({ galleryID: { $in: galleryIDs } }).lean()
        ]);

        // Create lookup maps for faster access
        const imagesMap = {};
        allImagesDocs.forEach(doc => {
            imagesMap[doc.galleryID] = doc;
        });

        const accessKeyMap = {};
        allAccessKeyDocs.forEach(doc => {
            accessKeyMap[doc.galleryID] = doc;
        });

        const galleryNameMap = {};
        allGalleryNames.forEach(doc => {
            galleryNameMap[doc.galleryID] = doc;
        });

        // Calculate overall stats
        let totalImages = 0;
        let totalSize = 0;
        let totalViews = 0;
        let totalDownloads = 0;
        let activeGalleries = 0;
        let expiredGalleries = 0;
        let draftGalleries = 0;
        const allTags = [];
        const allImageSizes = [];

        // Per-gallery stats
        const galleryStats = galleries.map(gallery => {
            const imagesDoc = imagesMap[gallery.galleryID];
            const accessKeyDoc = accessKeyMap[gallery.galleryID];
            const galleryNameDoc = galleryNameMap[gallery.galleryID];

            const imageCount = imagesDoc?.totalImages || 0;
            const imageSize = imagesDoc?.imagesDetails?.reduce((sum, img) => sum + (img.size || 0), 0) || 0;
            const views = gallery.metadata?.totalViews || 0;
            const downloads = gallery.metadata?.totalDownloads || 0;

            // Aggregate stats
            totalImages += imageCount;
            totalSize += imageSize;
            totalViews += views;
            totalDownloads += downloads;

            // Count statuses
            const status = galleryNameDoc?.galleryStatus || gallery.calculatedStatus || 'Active';
            if (status === 'Active') activeGalleries++;
            else if (status === 'Expired') expiredGalleries++;
            else if (status === 'Draft') draftGalleries++;

            // Collect tags
            if (imagesDoc?.imagesDetails) {
                imagesDoc.imagesDetails.forEach(img => {
                    if (img.tags?.length > 0) {
                        allTags.push(...img.tags);
                    }
                    if (img.size) {
                        allImageSizes.push(img.size);
                    }
                });
            }

            // Favorite images in this gallery
            const favoriteCount = imagesDoc?.imagesDetails?.filter(img => img.isFavorite).length || 0;

            return {
                galleryID: gallery.galleryID,
                galleryName: gallery.galleryName || galleryNameDoc?.galleryName || 'Untitled',
                clientName: gallery.name || 'N/A',
                clientEmail: gallery.email || 'N/A',
                status: status,
                createdAt: gallery.createdAt,
                expiresAt: gallery.expiresAt,
                expirationPeriod: gallery.expirationPeriod,
                imageStats: {
                    totalImages: imageCount,
                    totalSize: formatBytes(imageSize),
                    averageSize: imageCount > 0 ? formatBytes(imageSize / imageCount) : '0 B',
                    coverImage: imagesDoc?.coverImage || null,
                    favoriteCount: favoriteCount
                },
                accessStats: {
                    totalViews: views,
                    totalDownloads: downloads,
                    lastViewedAt: gallery.metadata?.lastViewedAt || null,
                    accessKeyActive: accessKeyDoc?.isActive ?? false,
                    totalAccessKeyUses: accessKeyDoc?.accessCount || 0
                },
                settings: {
                    allowDownloads: gallery.downloadPermission || gallery.gallerySettings?.allowDownloads || false,
                    requireAccessKey: gallery.gallerySettings?.requireAccessKey ?? true,
                    allowSocialShare: gallery.gallerySettings?.allowSocialShare ?? false
                },
                url: gallery.galleryURL || null
            };
        });

        // Calculate tag statistics
        const tagCount = {};
        allTags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });

        const topTags = Object.entries(tagCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));

        // Calculate overall image size stats
        const averageImageSize = allImageSizes.length > 0
            ? allImageSizes.reduce((sum, size) => sum + size, 0) / allImageSizes.length
            : 0;

        res.status(200).json({
            success: true,
            data: {
                // Overall stats
                overview: {
                    totalGalleries: galleries.length,
                    activeGalleries: activeGalleries,
                    expiredGalleries: expiredGalleries,
                    draftGalleries: draftGalleries,
                    totalImages: totalImages,
                    totalStorageUsed: formatBytes(totalSize),
                    totalViews: totalViews,
                    totalDownloads: totalDownloads,
                    averageImageSize: formatBytes(averageImageSize),
                    averageImagesPerGallery: galleries.length > 0 ? (totalImages / galleries.length).toFixed(1) : 0
                },
                // Tag statistics across all galleries
                tagStats: {
                    totalUniqueTags: Object.keys(tagCount).length,
                    topTags: topTags
                },
                // Per-gallery breakdown
                galleries: galleryStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            }
        });

    } catch (error) {
        console.error("Get gallery stats error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery statistics",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Get public gallery info (no auth required)
 * @route GET /api/gallery/main/public/:galleryID
 * @access Public
 */
export const getPublicGalleryInfo = async (req, res) => {
    try {
        const { galleryID } = req.params;

        const gallery = await Gallery.findOne({
            galleryID: galleryID,
            isDeleted: false
        }).select("galleryID name studioName gallerySettings galleryURL expiresAt metadata coverImage");

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        // Check if expired
        if (gallery.expiresAt && gallery.expiresAt < new Date()) {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }

        const imagesDoc = await GalleryImages.findOne({ galleryID: galleryID });

        res.status(200).json({
            success: true,
            data: {
                galleryID: gallery.galleryID,
                name: gallery.name,
                studioName: gallery.studioName,
                coverImage: imagesDoc?.coverImage || null,
                totalImages: imagesDoc?.totalImages || 0,
                gallerySettings: gallery.gallerySettings,
                galleryURL: gallery.galleryURL,
                expiresAt: gallery.expiresAt,
                totalViews: gallery.metadata.totalViews,
                createdAt: gallery.createdAt
            }
        });

    } catch (error) {
        console.error("Get public gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery information",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * Get all deleted galleries (for admin/owner)
 * @route GET /api/gallery/main/deleted/all
 * @access Private
 */
export const getDeletedGalleries = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;

        const deletedGalleries = await Gallery.find({
            userId: userId,
            isDeleted: true
        }).select("galleryID name studioName deletedAt createdAt");

        res.status(200).json({
            success: true,
            data: deletedGalleries,
            count: deletedGalleries.length
        });

    } catch (error) {
        console.error("Get deleted galleries error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching deleted galleries",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Get gallery with access key via POST (for public access)
export const getGalleryWithAccessKey = async (req, res) => {
    try {
        const { accessKey } = req.body;

        // Validate input
        if (!accessKey || accessKey.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Access key is required"
            });
        }

        // Find gallery by accessKey only
        const gallery = await Gallery.findOne({
            accessKey: accessKey.trim(),
            isDeleted: false
        }).lean();

        if (!gallery) {
            return res.status(401).json({
                success: false,
                message: "Invalid access key or gallery not found"
            });
        }

        // Check if gallery is expired
        if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date()) {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }

        // Get images from GalleryImages
        const galleryImagesDoc = await GalleryImages.findOne({ galleryID: gallery.galleryID });

        // Update view count
        await Gallery.updateOne(
            { galleryID: gallery.galleryID },
            {
                $inc: { "metadata.totalViews": 1 },
                $set: { "metadata.lastViewedAt": new Date() }
            }
        );

        // Return complete gallery data
        res.status(200).json({
            success: true,
            message: "Gallery retrieved successfully",
            data: {
                ...gallery,
                images: galleryImagesDoc?.imagesDetails || [],
                totalImages: galleryImagesDoc?.totalImages || 0,
                coverImage: galleryImagesDoc?.coverImage || null
            }
        });

    } catch (error) {
        console.error("Get gallery with access key error:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving gallery",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Get gallery by ID (for client access)
export const getGalleryByID = async (req, res) => {
    try {
        const { galleryID } = req.params;
        const { accessKey } = req.query;

        const gallery = await Gallery.findOne({ galleryID: galleryID, isDeleted: false });

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }

        // Check if access key is required and valid
        if (gallery.gallerySettings?.requireAccessKey !== false) {
            if (!accessKey || accessKey !== gallery.accessKey) {
                return res.status(401).json({
                    success: false,
                    message: "Access key required",
                    requiresAccessKey: true,
                    galleryName: gallery.galleryName
                });
            }
        }

        // Check if gallery is expired
        if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date()) {
            return res.status(403).json({
                success: false,
                message: "This gallery link has expired"
            });
        }

        // Update view count
        await Gallery.updateOne(
            { galleryID: galleryID },
            {
                $inc: { "metadata.totalViews": 1 },
                $set: { "metadata.lastViewedAt": new Date() }
            }
        );

        res.json({
            success: true,
            data: {
                galleryID: gallery.galleryID,
                galleryName: gallery.galleryName,
                studioName: gallery.studioName,
                downloadPermission: gallery.downloadPermission,
                expirationPeriod: gallery.expirationPeriod,
                expiresAt: gallery.expiresAt,
                totalImages: gallery.totalImages,
                gallerySettings: gallery.gallerySettings
            }
        });

    } catch (error) {
        console.error("Get gallery error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery",
            error: error.message
        });
    }
};


/**
 * Get user gallery details with client info
 * @route GET /api/gallery/main/user/details
 * @access Private
 */
export const getUserGalleryDetails = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const query = {
            userId: userId,
            isDeleted: false
        };

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [galleries, total] = await Promise.all([
            Gallery.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .select("_id galleryID galleryName galleryURL name email createdAt accessKey") // ✅ Added _id
                .lean(),
            Gallery.countDocuments(query)
        ]);

        const galleriesWithDetails = await Promise.all(
            galleries.map(async (gallery) => {
                const imagesDoc = await GalleryImages.findOne({ galleryID: gallery.galleryID }).select("totalImages coverImage").lean();
                const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: gallery.galleryID }).select("isActive").lean();

                return {
                    _id: gallery._id, // ✅ Include MongoDB _id
                    galleryUrl: gallery.galleryURL,
                    galleryInfo: {
                        _id: gallery._id, // ✅ Include in galleryInfo too
                        galleryID: gallery.galleryID,
                        galleryName: gallery.galleryName,
                        totalImages: imagesDoc?.totalImages || 0
                    },
                    accessKey: gallery.accessKey,
                    isAccessKeyActive: accessKeyDoc?.isActive ?? true,
                    clientDetails: {
                        clientName: gallery.name,
                        email: gallery.email,
                        dateCreated: gallery.createdAt
                    }
                };
            })
        );

        res.status(200).json({
            success: true,
            data: galleriesWithDetails,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                totalItems: total,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < Math.ceil(total / limitNum),
                hasPrevPage: pageNum > 1
            }
        });

    } catch (error) {
        console.error("Get user gallery details error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching gallery details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
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