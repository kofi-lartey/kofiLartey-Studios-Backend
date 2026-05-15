import { Router } from "express";
import { authenticate } from "../Middleware/auth.js";
import { createGalleryName, deleteGalleryName, getGalleryNameById, getUserGalleryNames, updateGalleryName, debugGalleryAccess } from "../Controllers/galleryNameController.js";
import { deleteImage, deleteMultipleImages, getGalleryImages, getImageById, uploadGalleryImages } from "../Controllers/galleryImagesController.js";
import { processMultipleImagesOptimized, uploadMultiple } from "../Utiles/uploadFiles.js";
import { generateAccessKey } from "../Utiles/additionals.js";
import { createGallery, getGalleryByID, validateGalleryAccess, getGalleryWithAccessKey, getUserGalleryDetails, deleteGallery, getGalleryAllStats } from "../Controllers/galleryMainController.js";

export const galleryRouter = Router();

// ==========================================
// STATIC ROUTES - Must come FIRST
// ==========================================

// Gallery Name Routes
galleryRouter.post('/create/galleryName', authenticate, createGalleryName);
galleryRouter.get('/gallery/names', authenticate, getUserGalleryNames);
galleryRouter.get("/gallery/name/:identifier", authenticate, getGalleryNameById);
galleryRouter.put("/gallery/name/:id", authenticate, updateGalleryName);
galleryRouter.delete("/gallery/name/:id", authenticate, deleteGalleryName);
galleryRouter.get("/debug/:galleryID", authenticate, debugGalleryAccess);

// Gallery Stats (static route before parameterized ones)
galleryRouter.get("/all/stats", authenticate, getGalleryAllStats);

// User gallery details
galleryRouter.get("/user/details", authenticate, getUserGalleryDetails);

// Main gallery creation
galleryRouter.post("/main/create", authenticate, createGallery);

// Delete gallery by ID
galleryRouter.delete("/main/:id", authenticate, deleteGallery);

// Generate Access Key
galleryRouter.post("/gallery/access-key/:galleryID/generate", authenticate, generateAccessKey);

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get gallery by access key - Public route
galleryRouter.get("/", getGalleryByID);

// Validate access key and get gallery - Public route
galleryRouter.get("/access/:galleryID", validateGalleryAccess);

// Get gallery with access key - Public route (POST with body)
galleryRouter.post("/public", getGalleryWithAccessKey);

// ==========================================
// PARAMETERIZED ROUTES - Must come LAST
// ==========================================

// Gallery Images and Details Routes
galleryRouter.post("/:galleryID/images/upload", authenticate, uploadMultiple, processMultipleImagesOptimized, uploadGalleryImages);
galleryRouter.get("/:galleryID/images", authenticate, getGalleryImages);
galleryRouter.get("/:galleryID/images/:imageId", authenticate, getImageById);
galleryRouter.delete("/:galleryID/images/deleteMultiple", authenticate, deleteMultipleImages);
galleryRouter.delete("/:galleryID/images/:imageId", authenticate, deleteImage);