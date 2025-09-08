import express from "express";
import admin from "firebase-admin";
import { v2 as cloudinary } from "cloudinary";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// 🔑 Load service account from env vars

const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};


// Cloudinary config
cloudinary.config({
  cloud_name: "dzqonzhli",
  api_key: "964771998452298",
  api_secret: "fS-exIyxH706tYEci4Bg9SdCxv4", // safe on server, not frontend
});

const app = express();
app.use(cors());
app.use(express.json());



// ✅ Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});


// Delete Project route
app.post("/deleteProject", async (req, res) => {
  const { projectId } = req.body;

  try {
    const projectRef = admin.firestore().collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = projectSnap.data();

     // Safe delete cover image
    if (project.coverImage && project.coverImage.publicId) {
      await cloudinary.uploader.destroy(project.coverImage.publicId).catch((err) => {
        console.warn("Cover image delete failed:", err.message);
      });
    }

    // Safe delete supporting images
    if (Array.isArray(project.supportingImages)) {
      for (const img of project.supportingImages) {
        if (img && img.publicId) {
          await cloudinary.uploader.destroy(img.publicId).catch((err) => {
            console.warn("Supporting image delete failed:", err.message);
          });
        }
      }
    }

    // Safe delete video
    if (project.video && project.video.publicId) {
      await cloudinary.uploader.destroy(project.video.publicId, { resource_type: "video" }).catch((err) => {
        console.warn("Video delete failed:", err.message);
      });
    }

    // Delete Firestore doc
    await projectRef.delete();

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete failed:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Update Project route
app.post("/updateProject", async (req, res) => {
  const {
    projectId,
    projectTitle,
    projectCategory,
    languages,
    description,
    githubLink,
    liveLink,
    toDeleteCover,
    toDeleteSupporting,
    toDeleteVideo,
    newCoverImage,
    newSupportingImages,
    newVideo,
  } = req.body;

  try {
    const projectRef = admin.firestore().collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = projectSnap.data();

    // Delete old cover image if marked
    if (toDeleteCover && project.coverImage && project.coverImage.publicId) {
      await cloudinary.uploader.destroy(project.coverImage.publicId).catch((err) => {
        console.warn("Cover image delete failed:", err.message);
      });
    }

    // Delete old supporting images if marked
    if (Array.isArray(toDeleteSupporting) && Array.isArray(project.supportingImages)) {
      for (const publicId of toDeleteSupporting) {
        const img = project.supportingImages.find(img => img.publicId === publicId);
        if (img && img.publicId) {
          await cloudinary.uploader.destroy(img.publicId).catch((err) => {
            console.warn("Supporting image delete failed:", err.message);
          });
        }
      }
    }

    // Delete old video if marked
    if (toDeleteVideo && project.video && project.video.publicId) {
      await cloudinary.uploader.destroy(project.video.publicId, { resource_type: "video" }).catch((err) => {
        console.warn("Video delete failed:", err.message);
      });
    }

    // Update Firestore document
    const updateData = {
      projectTitle,
      projectCategory,
      languages,
      description,
      githubLink,
      liveLink,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
   

    // Handle new cover image
    if (newCoverImage) {
      updateData.coverImage = newCoverImage;
    } else if (toDeleteCover) {
      updateData.coverImage = null;
    }

    // Handle new supporting images
    if (Array.isArray(newSupportingImages) && newSupportingImages.length > 0) {
      const currentSupporting = project.supportingImages || [];
      const remaining = currentSupporting.filter(img => !toDeleteSupporting.includes(img.publicId));
      updateData.supportingImages = [...remaining, ...newSupportingImages];
    } else if (Array.isArray(toDeleteSupporting) && toDeleteSupporting.length > 0) {
      const currentSupporting = project.supportingImages || [];
      updateData.supportingImages = currentSupporting.filter(img => !toDeleteSupporting.includes(img.publicId));
    }

    // Handle new video
    if (newVideo) {
      updateData.video = newVideo;
    } else if (toDeleteVideo) {
      updateData.video = null;
    }

    await projectRef.update(updateData);

    return res.json({ success: true });
  } catch (err) {
    console.error("Update failed:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
