
import {admin, cloudinary} from "../init.js";

// ✅ Handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { projectId } = req.body;
  try {
    const projectRef = admin.firestore().collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = projectSnap.data();

    // Safe delete cover image
    if (project.coverImage?.publicId) {
      await cloudinary.uploader.destroy(project.coverImage.publicId).catch(() => {});
    }

    // Safe delete supporting images
    if (Array.isArray(project.supportingImages)) {
      for (const img of project.supportingImages) {
        if (img?.publicId) {
          await cloudinary.uploader.destroy(img.publicId).catch(() => {});
        }
      }
    }

    // Safe delete video
    if (project.video?.publicId) {
      await cloudinary.uploader.destroy(project.video.publicId, { resource_type: "video" }).catch(() => {});
    }

    // Delete Firestore doc
    await projectRef.delete();

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete failed:", err);
    res.status(500).json({ error: "Delete failed" });
  }
}
