import { GalleryAccessKey } from "../Model/galleryModal.js";
import { GalleryName } from "../Model/galleryModal.js";
import { generateAccessKey } from "../Utiles/additionals.js";

/**
 * Generate/Regenerate access key for a gallery
 * @route POST /api/gallery/access-key/:galleryID/generate
 * @access Private
 */
export const generateAccessKeyForGallery = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Verify gallery ownership
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
        
        // Generate new access key
        const newAccessKey = generateAccessKey();
        
        // Check if access key already exists (for uniqueness)
        let isUnique = false;
        let attempts = 0;
        let finalAccessKey = newAccessKey;
        
        while (!isUnique && attempts < 3) {
            const existingKey = await GalleryAccessKey.findOne({ accessKey: finalAccessKey });
            if (!existingKey) {
                isUnique = true;
            } else {
                finalAccessKey = generateAccessKey();
                attempts++;
            }
        }
        
        // Find or create access key document
        let accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: galleryID });
        
        if (!accessKeyDoc) {
            // Create new access key document
            accessKeyDoc = new GalleryAccessKey({
                userId: userId,
                galleryID: galleryID,
                accessKey: finalAccessKey,
                accessKeyHistory: [],
                isActive: true
            });
        } else {
            // Regenerate existing key
            await accessKeyDoc.regenerateKey(finalAccessKey, userId, ipAddress, userAgent);
        }
        
        await accessKeyDoc.save();
        
        res.status(200).json({
            success: true,
            message: accessKeyDoc.accessKeyHistory.length > 0 ? "Access key regenerated successfully" : "Access key generated successfully",
            data: {
                galleryID: galleryID,
                accessKey: finalAccessKey,
                isActive: accessKeyDoc.isActive,
                accessCount: accessKeyDoc.accessCount,
                lastAccessedAt: accessKeyDoc.lastAccessedAt,
                generatedAt: accessKeyDoc.createdAt,
                historyCount: accessKeyDoc.accessKeyHistory.length
            }
        });
        
    } catch (error) {
        console.error("Generate access key error:", error);
        res.status(500).json({
            success: false,
            message: "Error generating access key",
            error: error.message
        });
    }
};

/**
 * Get access key details for a gallery
 * @route GET /api/gallery/access-key/:galleryID
 * @access Private
 */
export const getAccessKeyDetails = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        
        // Verify gallery ownership
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
        
        const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: galleryID });
        
        if (!accessKeyDoc) {
            return res.status(404).json({
                success: false,
                message: "No access key found for this gallery. Please generate one first."
            });
        }
        
        // Return access key details (without full history for security)
        res.status(200).json({
            success: true,
            data: {
                galleryID: accessKeyDoc.galleryID,
                accessKey: accessKeyDoc.accessKey,
                isActive: accessKeyDoc.isActive,
                accessCount: accessKeyDoc.accessCount,
                lastAccessedAt: accessKeyDoc.lastAccessedAt,
                createdAt: accessKeyDoc.createdAt,
                updatedAt: accessKeyDoc.updatedAt,
                historyCount: accessKeyDoc.accessKeyHistory.length,
                recentHistory: accessKeyDoc.accessKeyHistory.slice(-5).map(history => ({
                    generatedAt: history.generatedAt,
                    ipAddress: history.ipAddress,
                    regeneratedBy: history.regeneratedBy
                }))
            }
        });
        
    } catch (error) {
        console.error("Get access key error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching access key",
            error: error.message
        });
    }
};

/**
 * Validate access key for public gallery access
 * @route POST /api/gallery/access-key/validate
 * @access Public
 */
export const validateAccessKey = async (req, res) => {
    try {
        const { galleryID, accessKey } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        if (!galleryID || !accessKey) {
            return res.status(400).json({
                success: false,
                message: "Gallery ID and Access Key are required"
            });
        }
        
        // Find the access key document
        const accessKeyDoc = await GalleryAccessKey.findOne({ 
            galleryID: galleryID,
            accessKey: accessKey
        });
        
        if (!accessKeyDoc) {
            return res.status(401).json({
                success: false,
                message: "Invalid access key"
            });
        }
        
        // Check if access key is active
        if (!accessKeyDoc.isActive) {
            return res.status(403).json({
                success: false,
                message: "Access key is deactivated"
            });
        }
        
        // Check if access key has expired
        if (accessKeyDoc.expiresAt && accessKeyDoc.expiresAt < new Date()) {
            return res.status(403).json({
                success: false,
                message: "Access key has expired"
            });
        }
        
        // Check if gallery exists and is active
        const galleryName = await GalleryName.findOne({ galleryID: galleryID });
        
        if (!galleryName) {
            return res.status(404).json({
                success: false,
                message: "Gallery not found"
            });
        }
        
        if (galleryName.galleryStatus === "Expired") {
            return res.status(403).json({
                success: false,
                message: "This gallery has expired"
            });
        }
        
        // Record the access
        await accessKeyDoc.recordAccess(ipAddress, userAgent);
        
        // Generate access token or session
        const accessToken = Buffer.from(`${galleryID}:${accessKey}:${Date.now()}`).toString('base64');
        
        res.status(200).json({
            success: true,
            message: "Access key validated successfully",
            data: {
                galleryID: galleryID,
                galleryName: galleryName.galleryName,
                galleryStatus: galleryName.galleryStatus,
                accessToken: accessToken, // One-time use token for session
                expiresIn: accessKeyDoc.expiresAt ? Math.floor((accessKeyDoc.expiresAt - new Date()) / 1000) : null
            }
        });
        
    } catch (error) {
        console.error("Validate access key error:", error);
        res.status(500).json({
            success: false,
            message: "Error validating access key",
            error: error.message
        });
    }
};

/**
 * Deactivate access key for a gallery
 * @route POST /api/gallery/access-key/:galleryID/deactivate
 * @access Private
 */
export const deactivateAccessKey = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        
        // Verify gallery ownership
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
        
        const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: galleryID });
        
        if (!accessKeyDoc) {
            return res.status(404).json({
                success: false,
                message: "Access key not found"
            });
        }
        
        await accessKeyDoc.deactivate();
        
        res.status(200).json({
            success: true,
            message: "Access key deactivated successfully",
            data: {
                galleryID: galleryID,
                isActive: false,
                deactivatedAt: new Date()
            }
        });
        
    } catch (error) {
        console.error("Deactivate access key error:", error);
        res.status(500).json({
            success: false,
            message: "Error deactivating access key",
            error: error.message
        });
    }
};

/**
 * Activate access key for a gallery
 * @route POST /api/gallery/access-key/:galleryID/activate
 * @access Private
 */
export const activateAccessKey = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        
        // Verify gallery ownership
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
        
        const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: galleryID });
        
        if (!accessKeyDoc) {
            return res.status(404).json({
                success: false,
                message: "Access key not found"
            });
        }
        
        accessKeyDoc.isActive = true;
        await accessKeyDoc.save();
        
        res.status(200).json({
            success: true,
            message: "Access key activated successfully",
            data: {
                galleryID: galleryID,
                accessKey: accessKeyDoc.accessKey,
                isActive: true,
                activatedAt: new Date()
            }
        });
        
    } catch (error) {
        console.error("Activate access key error:", error);
        res.status(500).json({
            success: false,
            message: "Error activating access key",
            error: error.message
        });
    }
};

/**
 * Get access statistics for a gallery
 * @route GET /api/gallery/access-key/:galleryID/stats
 * @access Private
 */
export const getAccessKeyStats = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        
        // Verify gallery ownership
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
        
        const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: galleryID });
        
        if (!accessKeyDoc) {
            return res.status(404).json({
                success: false,
                message: "Access key not found"
            });
        }
        
        // Calculate additional stats
        const totalRegenerations = accessKeyDoc.accessKeyHistory.length;
        const lastRegeneration = accessKeyDoc.accessKeyHistory[accessKeyDoc.accessKeyHistory.length - 1];
        
        res.status(200).json({
            success: true,
            data: {
                galleryID: galleryID,
                accessKey: accessKeyDoc.accessKey.substring(0, 8) + "***", // Partial key for security
                isActive: accessKeyDoc.isActive,
                accessCount: accessKeyDoc.accessCount,
                lastAccessedAt: accessKeyDoc.lastAccessedAt,
                createdAt: accessKeyDoc.createdAt,
                updatedAt: accessKeyDoc.updatedAt,
                stats: {
                    totalRegenerations: totalRegenerations,
                    lastRegenerationAt: lastRegeneration?.generatedAt || null,
                    lastRegenerationBy: lastRegeneration?.regeneratedBy || null,
                    averageAccessPerDay: calculateAverageAccessPerDay(accessKeyDoc)
                },
                history: accessKeyDoc.accessKeyHistory.slice(-10).map(history => ({
                    regeneratedAt: history.generatedAt,
                    ipAddress: history.ipAddress,
                    regeneratedBy: history.regeneratedBy
                }))
            }
        });
        
    } catch (error) {
        console.error("Get access stats error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching access statistics",
            error: error.message
        });
    }
};

/**
 * Revoke all access keys and history for a gallery
 * @route DELETE /api/gallery/access-key/:galleryID/revoke-all
 * @access Private
 */
export const revokeAllAccessKeys = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { galleryID } = req.params;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Verify gallery ownership
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
        
        const accessKeyDoc = await GalleryAccessKey.findOne({ galleryID: galleryID });
        
        if (!accessKeyDoc) {
            return res.status(404).json({
                success: false,
                message: "Access key not found"
            });
        }
        
        // Generate completely new key
        const newAccessKey = generateAccessKey();
        
        // Save current to history and set new key
        await accessKeyDoc.regenerateKey(newAccessKey, userId, ipAddress, userAgent);
        
        // Reset access count
        accessKeyDoc.accessCount = 0;
        accessKeyDoc.lastAccessedAt = null;
        await accessKeyDoc.save();
        
        res.status(200).json({
            success: true,
            message: "All access keys revoked. New access key generated.",
            data: {
                galleryID: galleryID,
                newAccessKey: newAccessKey,
                previousKeysCount: accessKeyDoc.accessKeyHistory.length
            }
        });
        
    } catch (error) {
        console.error("Revoke access keys error:", error);
        res.status(500).json({
            success: false,
            message: "Error revoking access keys",
            error: error.message
        });
    }
};

/**
 * Bulk validate multiple access keys (for batch operations)
 * @route POST /api/gallery/access-key/bulk-validate
 * @access Public
 */
export const bulkValidateAccessKeys = async (req, res) => {
    try {
        const { galleries } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        if (!galleries || !Array.isArray(galleries) || galleries.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Galleries array is required"
            });
        }
        
        const validationResults = [];
        
        for (const gallery of galleries) {
            const { galleryID, accessKey } = gallery;
            
            if (!galleryID || !accessKey) {
                validationResults.push({
                    galleryID: galleryID || "unknown",
                    success: false,
                    message: "Gallery ID and Access Key are required"
                });
                continue;
            }
            
            const accessKeyDoc = await GalleryAccessKey.findOne({ 
                galleryID: galleryID,
                accessKey: accessKey
            });
            
            if (!accessKeyDoc || !accessKeyDoc.isActive) {
                validationResults.push({
                    galleryID: galleryID,
                    success: false,
                    message: "Invalid or inactive access key"
                });
                continue;
            }
            
            // Record access
            await accessKeyDoc.recordAccess(ipAddress, userAgent);
            
            validationResults.push({
                galleryID: galleryID,
                success: true,
                message: "Access key validated successfully"
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                totalValidated: validationResults.filter(r => r.success).length,
                totalFailed: validationResults.filter(r => !r.success).length,
                results: validationResults
            }
        });
        
    } catch (error) {
        console.error("Bulk validate error:", error);
        res.status(500).json({
            success: false,
            message: "Error validating access keys",
            error: error.message
        });
    }
};

// Helper function to calculate average access per day
const calculateAverageAccessPerDay = (accessKeyDoc) => {
    if (!accessKeyDoc.createdAt || accessKeyDoc.accessCount === 0) return 0;
    
    const daysSinceCreation = Math.max(1, Math.ceil((new Date() - accessKeyDoc.createdAt) / (1000 * 60 * 60 * 24)));
    return (accessKeyDoc.accessCount / daysSinceCreation).toFixed(2);
};