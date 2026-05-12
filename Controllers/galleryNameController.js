import { GalleryName } from "../Model/galleryModal.js";
import { createGalleryNameSchema } from "../Scheme/gallerySchema.js";
import { generateGalleryID } from "../Utiles/additionals.js";

/**
 * Create a new gallery name entry
 * @route POST /api/gallery/name
 * @access Private
 */
export const createGalleryName = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        
        // Validate request body
        const { error, value } = createGalleryNameSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }
        
        const { galleryName } = value;
        
        // Check if gallery name already exists for the user
        const existingGallery = await GalleryName.findOne({ 
            userId: userId,  // Changed from 'user' to 'userId' to match schema
            galleryName: galleryName 
        });
        
        if (existingGallery) {
            return res.status(400).json({ 
                success: false, 
                message: "Gallery name already exists. Please choose a different name." 
            });
        }
        
        // Generate unique gallery ID (from your additional file)
        let galleryId = generateGalleryID();
        
        // Ensure galleryID is unique (optional but recommended)
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 3) {
            const existingId = await GalleryName.findOne({ galleryID: galleryId });
            if (!existingId) {
                isUnique = true;
            } else {
                galleryId = generateGalleryID();
                attempts++;
            }
        }
        
        // Create and save the new gallery name
        const newGalleryName = await GalleryName.create({
            userId: userId,           // Changed from 'user' to 'userId'
            galleryName: galleryName,
            galleryID: galleryId,     // Changed from 'galleryId' to 'galleryID' to match schema
            galleryStatus: "Draft",   // Changed from "Active" to "Draft" (will be activated when fully configured)
            galleryDateCreated: new Date(),
        });
        
        res.status(201).json({
            success: true,
            message: "Gallery name created successfully.",
            data: {
                id: newGalleryName._id,
                userId: newGalleryName.userId,
                galleryName: newGalleryName.galleryName,
                galleryID: newGalleryName.galleryID,
                galleryStatus: newGalleryName.galleryStatus,
                galleryDateCreated: newGalleryName.galleryDateCreated,
                createdAt: newGalleryName.createdAt,
                updatedAt: newGalleryName.updatedAt
            }
        });
        
    } catch (error) {
        // Handle duplicate key error (MongoDB)
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: "Gallery name or ID already exists. Please try again." 
            });
        }
        
        console.error("Create gallery name error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * Get all gallery names for authenticated user
 * @route GET /api/gallery/names
 * @access Private
 */
export const getUserGalleryNames = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Filter by status if provided
        const query = { userId: userId };
        if (req.query.status && req.query.status !== 'all') {
            query.galleryStatus = req.query.status;
        }
        
        const [galleries, total] = await Promise.all([
            GalleryName.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            GalleryName.countDocuments(query)
        ]);
        
        res.status(200).json({
            success: true,
            data: galleries,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
        
    } catch (error) {
        console.error("Get user galleries error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * Get single gallery name by ID or galleryID
 * @route GET /api/gallery/name/:identifier
 * @access Private
 */
export const getGalleryNameById = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { identifier } = req.params;
        
        // Check if identifier is MongoDB ObjectId or galleryID
        const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/);
        
        let query = { userId: userId };
        if (isObjectId) {
            query._id = identifier;
        } else {
            query.galleryID = identifier;
        }
        
        const gallery = await GalleryName.findOne(query);
        
        if (!gallery) {
            return res.status(404).json({ 
                success: false, 
                message: "Gallery not found" 
            });
        }
        
        res.status(200).json({
            success: true,
            data: gallery
        });
        
    } catch (error) {
        console.error("Get gallery error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * Update gallery name
 * @route PUT /api/gallery/name/:id
 * @access Private
 */
export const updateGalleryName = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        const { galleryName, galleryStatus } = req.body;
        
        // Find gallery and verify ownership
        const gallery = await GalleryName.findOne({ 
            _id: id, 
            userId: userId 
        });
        
        if (!gallery) {
            return res.status(404).json({ 
                success: false, 
                message: "Gallery not found" 
            });
        }
        
        // Update gallery name if provided
        if (galleryName && galleryName !== gallery.galleryName) {
            // Check if new name already exists
            const existingName = await GalleryName.findOne({
                userId: userId,
                galleryName: galleryName,
                _id: { $ne: id }
            });
            
            if (existingName) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Gallery name already exists" 
                });
            }
            
            gallery.galleryName = galleryName;
        }
        
        // Update status if provided
        if (galleryStatus) {
            gallery.galleryStatus = galleryStatus;
        }
        
        await gallery.save();
        
        res.status(200).json({
            success: true,
            message: "Gallery name updated successfully",
            data: gallery
        });
        
    } catch (error) {
        console.error("Update gallery error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * Delete gallery name
 * @route DELETE /api/gallery/name/:id
 * @access Private
 */
export const deleteGalleryName = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        
        const gallery = await GalleryName.findOneAndDelete({ 
            _id: id, 
            userId: userId 
        });
        
        if (!gallery) {
            return res.status(404).json({ 
                success: false, 
                message: "Gallery not found" 
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Gallery name deleted successfully",
            data: {
                id: gallery._id,
                galleryName: gallery.galleryName,
                galleryID: gallery.galleryID
            }
        });
        
    } catch (error) {
        console.error("Delete gallery error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

/**
 * Check if gallery name is available
 * @route GET /api/gallery/check-name/:galleryName
 * @access Private
 */
export const checkGalleryNameAvailability = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryName } = req.params;
        
        const existingGallery = await GalleryName.findOne({
            userId: userId,
            galleryName: galleryName
        });
        
        res.status(200).json({
            success: true,
            data: {
                galleryName: galleryName,
                isAvailable: !existingGallery,
                message: existingGallery ? "Gallery name is already taken" : "Gallery name is available"
            }
        });
        
    } catch (error) {
        console.error("Check name availability error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};


// Debug endpoint - Add to your controller
export const debugGalleryAccess = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        
        // Find all galleries for this user
        const userGalleries = await GalleryName.find({ userId: userId });
        
        // Find the specific gallery
        const specificGallery = await GalleryName.findOne({ galleryID: galleryID });
        
        // Check case sensitivity
        const caseInsensitiveSearch = await GalleryName.findOne({
            galleryID: { $regex: new RegExp(`^${galleryID}$`, 'i') }
        });
        
        res.status(200).json({
            success: true,
            debug: {
                requestedGalleryID: galleryID,
                requestedGalleryIDLength: galleryID.length,
                userId: userId,
                userTotalGalleries: userGalleries.length,
                userGalleriesList: userGalleries.map(g => ({
                    id: g._id,
                    galleryID: g.galleryID,
                    galleryName: g.galleryName,
                    status: g.galleryStatus
                })),
                specificGalleryFound: !!specificGallery,
                specificGalleryData: specificGallery ? {
                    id: specificGallery._id,
                    galleryID: specificGallery.galleryID,
                    galleryName: specificGallery.galleryName,
                    userId: specificGallery.userId,
                    status: specificGallery.galleryStatus
                } : null,
                caseInsensitiveFound: !!caseInsensitiveSearch,
                exactMatch: specificGallery?.galleryID === galleryID,
                trimmedMatch: specificGallery?.galleryID?.trim() === galleryID?.trim()
            }
        });
        
    } catch (error) {
        console.error("Debug error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};