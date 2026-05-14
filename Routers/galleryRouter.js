import { Router } from "express";
import { authenticate } from "../Middleware/auth.js";
import { createGalleryName, deleteGalleryName, getGalleryNameById, getUserGalleryNames, updateGalleryName,debugGalleryAccess } from "../Controllers/galleryNameController.js";
import { deleteImage, getGalleryImages, getImageById, uploadGalleryImages } from "../Controllers/galleryImagesController.js";
import {   processMultipleImagesOptimized, uploadMultiple } from "../Utiles/uploadFiles.js";
import { generateAccessKey } from "../Utiles/additionals.js";
import { createGallery, getGalleryByID, validateGalleryAccess } from "../Controllers/galleryMainController.js";

export const galleryRouter = Router();


// Gallery Name Routes
galleryRouter.post('/create/galleryName',authenticate,createGalleryName)
galleryRouter.get('/gallery/names', authenticate, getUserGalleryNames);
galleryRouter.get("/gallery/name/:identifier", authenticate, getGalleryNameById);
galleryRouter.put("/gallery/name/:id", authenticate, updateGalleryName);
galleryRouter.delete("/gallery/name/:id", authenticate, deleteGalleryName);
galleryRouter.get("/debug/:galleryID", authenticate, debugGalleryAccess);


// Gallery Images and Details Routes
galleryRouter.post("/:galleryID/images/upload", authenticate,uploadMultiple,processMultipleImagesOptimized,uploadGalleryImages);
galleryRouter.get("/:galleryID/images",authenticate, getGalleryImages);
galleryRouter.get("/:galleryID/images/:imageId", authenticate, getImageById);
galleryRouter.delete("/:galleryID/images/:imageId", authenticate, deleteImage);
// galleryRouter.get("/test-cloudinary", testCloudinaryConnection)

// generate Access Key
galleryRouter.post("/gallery/access-key/:galleryID/generate", authenticate, generateAccessKey);


// main gallery creation
galleryRouter.post("/main/create", authenticate, createGallery)

// Get gallery by ID (for client access) - Public route
galleryRouter.get("/:galleryID", getGalleryByID)

// Validate access key and get gallery - Public route (GET with query params)
galleryRouter.get("/access/:galleryID", validateGalleryAccess);