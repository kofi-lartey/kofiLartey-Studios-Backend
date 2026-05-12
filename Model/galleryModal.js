import { Schema } from "mongoose";
import { model } from "mongoose";
import normalize from "normalize-mongoose";

// ===========================================
// MAIN GALLERY SCHEMA
// ===========================================
export const gallerySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    galleryID: {
        type: String,
        ref: 'GalleryName',
        required: true,
        unique: true,
        index: true,
    },
    galleryName: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    studioName: {
        type: String,
        required: true,
    },
    expirationPeriod: {
        type: String,
        enum: ["Never Expire", "1 hour", "24 hours", "7 days", "30 days"],
        default: "Never Expire",
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    downloadPermission: {
        type: Boolean,
        default: false,
    },
    galleryURL: {
        type: String,
        default: null,
    },
    accessKey: {
        type: String,
        required: true,
        unique: true
    },
    images: {
        type: Array,
        default: []
    },
    totalImages: {
        type: Number,
        default: 0
    },
    gallerySettings: {
        allowDownloads: { type: Boolean, default: false },
        allowWatermark: { type: Boolean, default: false },
        themeColor: { type: String, default: "#000000" },
        allowSocialShare: { type: Boolean, default: true },
        requireAccessKey: { type: Boolean, default: true },
    },
    metadata: {
        totalViews: { type: Number, default: 0 },
        totalDownloads: { type: Number, default: 0 },
        lastViewedAt: { type: Date, default: null },
        clientNotes: { type: String, default: null },
        tags: { type: [String], default: [] },
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Indexes
gallerySchema.index({ userId: 1, email: 1 });
gallerySchema.index({ galleryID: 1, isDeleted: 1 });
gallerySchema.index({ expiresAt: 1 });

// Virtuals
gallerySchema.virtual('calculatedStatus').get(function () {
    if (this.expiresAt && this.expiresAt < new Date()) {
        return 'Expired';
    }
    return 'Active';
});

// Methods
gallerySchema.methods.incrementViews = function () {
    this.metadata.totalViews += 1;
    this.metadata.lastViewedAt = new Date();
    return this.save();
};

gallerySchema.methods.incrementDownloads = function (count = 1) {
    this.metadata.totalDownloads += count;
    return this.save();
};

gallerySchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

gallerySchema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
};


// Change this block in galleryModal.js
// galleryModal.js

// Pre-save middleware
gallerySchema.pre('save', async function () {
    // 'this' refers to the document being saved
    if (this.isModified('expirationPeriod')) {
        const calculateExpirationDate = (expirationPeriod) => {
            if (expirationPeriod === "Never Expire") return null;
            const now = new Date();
            switch (expirationPeriod) {
                case "1 hour": return new Date(now.getTime() + 60 * 60 * 1000);
                case "24 hours": return new Date(now.getTime() + 24 * 60 * 60 * 1000);
                case "7 days": return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                case "30 days": return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                default: return null;
            }
        };
        this.expiresAt = calculateExpirationDate(this.expirationPeriod);
    }
    // No next() needed for async functions
});

// Plugin (uncommented – required)
gallerySchema.plugin(normalize);

// ===========================================
// GALLERY ACCESS KEY SCHEMA
// ===========================================
export const galleryAccessKeySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    galleryID: {
        type: String,
        ref: 'GalleryName',
        required: true,
        unique: true,
        index: true,
    },
    accessKey: {
        type: String,
        required: true,
        unique: true,
    },
    accessKeyHistory: [{
        key: { type: String },
        generatedAt: { type: Date, default: Date.now },
        ipAddress: { type: String },
        userAgent: { type: String },
        regeneratedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }],
    lastAccessedAt: {
        type: Date,
        default: null,
    },
    accessCount: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Methods for galleryAccessKeySchema
galleryAccessKeySchema.methods.recordAccess = function (ipAddress = null, userAgent = null) {
    this.accessCount += 1;
    this.lastAccessedAt = new Date();
    return this.save();
};

galleryAccessKeySchema.methods.regenerateKey = function (newKey, regeneratedBy, ipAddress = null, userAgent = null) {
    this.accessKeyHistory.push({
        key: this.accessKey,
        generatedAt: new Date(),
        ipAddress: ipAddress,
        userAgent: userAgent,
        regeneratedBy: regeneratedBy
    });
    this.accessKey = newKey;
    return this.save();
};

galleryAccessKeySchema.methods.deactivate = function () {
    this.isActive = false;
    return this.save();
};

galleryAccessKeySchema.plugin(normalize);

// ===========================================
// IMAGE DETAIL SUB-SCHEMA
// ===========================================
const imageDetailSchema = new Schema({
    imageId: { type: String, required: true, index: true },
    imageName: { type: String, required: true },
    originalName: { type: String, required: true },
    imageUrl: { type: String, required: true },
    size: { type: Number, required: true },
    sizeFormatted: { type: String, required: true },
    mimeType: { type: String, required: true },
    extension: { type: String, required: true },
    dimensions: {
        width: { type: Number, default: null },
        height: { type: Number, default: null }
    },
    iso: { type: Number, default: null },
    aperture: { type: String, default: null },
    shutterSpeed: { type: String, default: null },
    cameraModel: { type: String, default: null },
    dateTaken: { type: Date, default: null },
    uploadedAt: { type: Date, default: Date.now },
    tags: { type: [String], default: [] },
    isFavorite: { type: Boolean, default: false },
    description: { type: String, default: null },
    order: { type: Number, default: 0 }
}, { _id: true });

// ===========================================
// GALLERY IMAGES SCHEMA
// ===========================================
export const galleryImagesSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    galleryID: {
        type: String,
        ref: "GalleryName",
        required: true,
        index: true
    },
    imagesDetails: {
        type: [imageDetailSchema],
        default: []
    },
    totalImages: {
        type: Number,
        default: 0
    },
    coverImage: {
        type: String,
        default: null
    },
    lastImageUploadedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Indexes for galleryImagesSchema
galleryImagesSchema.index({ galleryID: 1, "imagesDetails.imageId": 1 });
galleryImagesSchema.index({ userId: 1, totalImages: -1 });

galleryImagesSchema.plugin(normalize);

// ===========================================
// GALLERY NAME SCHEMA
// ===========================================
export const galleryNameSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    galleryName: {
        type: String,
        required: true,
        trim: true,
    },
    galleryID: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    galleryStatus: {
        type: String,
        enum: ["Active", "Expired", "Draft"],
        default: "Draft",
    },
    galleryDateCreated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// Compound index to ensure unique gallery name per user
galleryNameSchema.index({ userId: 1, galleryName: 1 }, { unique: true });
galleryNameSchema.plugin(normalize);

// ===========================================
// EXPORT ALL MODELS
// ===========================================
export const Gallery = model("Gallery", gallerySchema);
export const GalleryAccessKey = model("GalleryAccessKey", galleryAccessKeySchema);
export const GalleryImages = model("GalleryImages", galleryImagesSchema);
export const GalleryName = model("GalleryName", galleryNameSchema);