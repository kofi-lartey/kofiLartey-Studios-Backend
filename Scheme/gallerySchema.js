import Joi from "joi";

// ==================== IMAGE DETAILS VALIDATION ====================

// Image dimensions validation schema
const imageDimensionsSchema = Joi.object({
    width: Joi.number()
        .integer()
        .positive()
        .allow(null)
        .default(null),

    height: Joi.number()
        .integer()
        .positive()
        .allow(null)
        .default(null)
});

const imageDetailSchema = Joi.object({
    imageId: Joi.string().required(),

    imageName: Joi.string()
        .min(1)
        .max(255)
        .required(),

    originalName: Joi.string()
        .min(1)
        .max(255)
        .required(),

    imageUrl: Joi.string()
        .uri()
        .required(),

    size: Joi.number()
        .positive()
        .required(),

    sizeFormatted: Joi.string().required(),

    mimeType: Joi.string()
        .pattern(
            /^image\/(jpeg|png|gif|webp|bmp|svg\+xml|heic|heif)$/
        )
        .required(),

    extension: Joi.string()
        .pattern(/^\.[a-zA-Z0-9]+$/)
        .required(),

    dimensions:
        imageDimensionsSchema.default({
            width: null,
            height: null
        }),

    iso: Joi.number()
        .integer()
        .min(0)
        .allow(null),

    aperture: Joi.string().allow(null),

    shutterSpeed: Joi.string().allow(null),

    cameraModel: Joi.string().allow(null),

    dateTaken: Joi.date()
        .iso()
        .allow(null),

    uploadedAt: Joi.date()
        .iso()
        .default(() => new Date()),

    tags: Joi.array().items(
        Joi.string().trim().lowercase()
    ),

    isFavorite: Joi.boolean().default(false),

    description: Joi.string()
        .max(1000)
        .allow(null),

    order: Joi.number()
        .integer()
        .min(0)
        .default(0)
});

const createGalleryImageSchema =
    Joi.object({
        userId: Joi.string().required(),

        galleryID: Joi.string().required(),

        imagesDetails: Joi.array()
            .items(imageDetailSchema)
            .default([]),

        totalImages: Joi.number()
            .integer()
            .min(0)
            .default(0),

        coverImage: Joi.string()
            .uri()
            .allow(null),

        lastImageUploadedAt: Joi.date()
            .allow(null)
    });
// ==================== GALLERY NAME VALIDATION ====================

// Gallery name creation validation
const createGalleryNameSchema = Joi.object({
    userId: Joi.string(),
    galleryName: Joi.string().min(3).max(100).required().trim(),
    galleryID: Joi.string().min(6).max(50).pattern(/^[A-Z0-9\-_]+$/),
    galleryStatus: Joi.string().valid("Active", "Expired", "Draft").default("Draft"),
    galleryDateCreated: Joi.date().default(Date.now)
});

// Update gallery name validation
const updateGalleryNameSchema = Joi.object({
    galleryName: Joi.string().min(3).max(100).trim(),
    galleryStatus: Joi.string().valid("Active", "Expired", "Draft")
}).min(1);

// ==================== GALLERY ACCESS KEY VALIDATION ====================

// Access key history entry validation
const accessKeyHistorySchema = Joi.object({
    key: Joi.string().required(),
    generatedAt: Joi.date().default(Date.now),
    ipAddress: Joi.string().ip().allow(null),
    userAgent: Joi.string().allow(null),
    regeneratedBy: Joi.string().required()
});

// Gallery access key creation validation
const createGalleryAccessKeySchema = Joi.object({
    userId: Joi.string().required(),
    galleryID: Joi.string().required(),
    accessKey: Joi.string().min(8).max(20).required().pattern(/^[A-Z0-9]+$/),
    accessKeyHistory: Joi.array().items(accessKeyHistorySchema).default([]),
    isActive: Joi.boolean().default(true),
    expiresAt: Joi.date().allow(null)
});

// Regenerate access key validation
const regenerateAccessKeySchema = Joi.object({
    newKey: Joi.string().min(8).max(20).required().pattern(/^[A-Z0-9]+$/),
    regeneratedBy: Joi.string().required(),
    ipAddress: Joi.string().ip().allow(null),
    userAgent: Joi.string().allow(null)
});

// Record access validation
const recordAccessSchema = Joi.object({
    ipAddress: Joi.string().ip().allow(null),
    userAgent: Joi.string().allow(null)
});

// ==================== GALLERY IMAGES VALIDATION ====================


// Add single image validation
const addImageSchema = Joi.object({
    imageDetails: imageDetailSchema.required()
});

// Add multiple images validation
const addMultipleImagesSchema = Joi.object({
    images: Joi.array().items(imageDetailSchema).min(1).max(100).required()
});

// Update image details validation
const updateImageDetailsSchema = Joi.object({
    imageName: Joi.string().min(1).max(255),
    tags: Joi.array().items(Joi.string().trim().lowercase()),
    isFavorite: Joi.boolean(),
    description: Joi.string().max(1000).allow(null),
    order: Joi.number().integer().min(0)
}).min(1);

// Reorder images validation
const reorderImagesSchema = Joi.object({
    imageIdsInOrder: Joi.array().items(Joi.string()).min(1).required()
});

// ==================== MAIN GALLERY VALIDATION ====================

// Gallery settings validation
const gallerySettingsSchema = Joi.object({
    allowDownloads: Joi.boolean().default(false),
    allowWatermark: Joi.boolean().default(false),
    themeColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default("#000000"),
    allowSocialShare: Joi.boolean().default(true),
    requireAccessKey: Joi.boolean().default(true)
});

// Gallery metadata validation
const galleryMetadataSchema = Joi.object({
    totalViews: Joi.number().integer().min(0).default(0),
    totalDownloads: Joi.number().integer().min(0).default(0),
    lastViewedAt: Joi.date().allow(null),
    clientNotes: Joi.string().max(2000).allow(null),
    tags: Joi.array().items(Joi.string().trim().lowercase())
});

// Main gallery creation validation
const createGallerySchema = Joi.object({
    userId: Joi.string(),
    galleryID: Joi.string().required(),
    name: Joi.string().min(2).max(100).required().trim(),
    email: Joi.string().email().required().lowercase().trim(),
    studioName: Joi.string().min(2).max(100).required().trim(),
    expirationPeriod: Joi.string().valid("Never Expire", "1 hour", "24 hours", "7 days", "30 days").default("Never Expire"),
    downloadPermission: Joi.boolean().default(false),
    galleryURL: Joi.string().uri().allow(null),
    gallerySettings: gallerySettingsSchema.default(),
    metadata: galleryMetadataSchema.default(),
    isDeleted: Joi.boolean().default(false)
});

// Update main gallery validation
const updateGallerySchema = Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    email: Joi.string().email().lowercase().trim(),
    studioName: Joi.string().min(2).max(100).trim(),
    expirationPeriod: Joi.string().valid("Never Expire", "1 hour", "24 hours", "7 days", "30 days"),
    downloadPermission: Joi.boolean(),
    galleryURL: Joi.string().uri().allow(null),
    gallerySettings: gallerySettingsSchema,
    metadata: galleryMetadataSchema
}).min(1);

// ==================== COMPLETE GALLERY CREATION VALIDATION ====================

// Complete gallery creation (all schemas combined)
const completeGalleryCreationSchema = Joi.object({
    // Basic info
    galleryName: Joi.string().min(3).max(100).required(),
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    studioName: Joi.string().min(2).max(100).required(),

    // Configuration
    expirationPeriod: Joi.string().valid("Never Expire", "1 hour", "24 hours", "7 days", "30 days").default("Never Expire"),
    downloadPermission: Joi.boolean().default(false),
    gallerySettings: gallerySettingsSchema.default(),

    // Access key (auto-generated if not provided)
    customAccessKey: Joi.string().min(8).max(20).pattern(/^[A-Z0-9]+$/).optional(),

    // Metadata
    tags: Joi.array().items(Joi.string().trim().lowercase()),
    clientNotes: Joi.string().max(2000).allow(null)
});

// ==================== QUERY VALIDATION ====================

// Pagination and filtering validation
const paginationQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'galleryName', 'totalImages', 'totalViews').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    galleryStatus: Joi.string().valid('Active', 'Expired', 'Draft', 'all').default('all'),
    search: Joi.string().min(1).max(100).optional(),
    isDeleted: Joi.boolean().default(false)
});

// Gallery images query validation
const galleryImagesQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    isFavorite: Joi.boolean(),
    tag: Joi.string().trim().lowercase(),
    search: Joi.string().min(1).max(100)
});

// ==================== ID PARAM VALIDATION ====================

// Gallery ID parameter validation
const galleryIdParamSchema = Joi.object({
    id: Joi.string().required(),
    galleryID: Joi.string().required()
});

// Image ID parameter validation
const imageIdParamSchema = Joi.object({
    id: Joi.string().required(),
    imageId: Joi.string().required()
});

// ==================== EXPORT ALL VALIDATORS ====================

export {
    // Image validators
    imageDetailSchema,

    // Gallery name validators
    createGalleryNameSchema,
    updateGalleryNameSchema,

    // Access key validators
    createGalleryAccessKeySchema,
    regenerateAccessKeySchema,
    recordAccessSchema,

    // Gallery images validators
    createGalleryImageSchema,
    addImageSchema,
    addMultipleImagesSchema,
    updateImageDetailsSchema,
    reorderImagesSchema,

    // Main gallery validators
    createGallerySchema,
    updateGallerySchema,
    gallerySettingsSchema,
    galleryMetadataSchema,

    // Combined validators
    completeGalleryCreationSchema,

    // Query validators
    paginationQuerySchema,
    galleryImagesQuerySchema,

    // Param validators
    galleryIdParamSchema,
    imageIdParamSchema
};