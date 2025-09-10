import {admin, cloudinary} from "../init.js";


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
    const updateData = {
      projectTitle,
      projectCategory,
      languages,
      description,
      githubLink,
      liveLink,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Handle cover image
    if (toDeleteCover && project.coverImage?.publicId) {
      await cloudinary.uploader.destroy(project.coverImage.publicId).catch(() => {});
      updateData.coverImage = null;
    } else if (newCoverImage) {
      updateData.coverImage = newCoverImage;
    }

    // Handle supporting images
    if (Array.isArray(toDeleteSupporting) && Array.isArray(project.supportingImages)) {
      const remaining = project.supportingImages.filter(img => !toDeleteSupporting.includes(img.publicId));
      updateData.supportingImages = remaining;
    }
    if (Array.isArray(newSupportingImages) && newSupportingImages.length > 0) {
      updateData.supportingImages = [...(updateData.supportingImages || project.supportingImages || []), ...newSupportingImages];
    }

    // Handle video
    if (toDeleteVideo && project.video?.publicId) {
      await cloudinary.uploader.destroy(project.video.publicId, { resource_type: "video" }).catch(() => {});
      updateData.video = null;
    } else if (newVideo) {
      updateData.video = newVideo;
    }

    await projectRef.update(updateData);
    return res.json({ success: true });
  } catch (err) {
    console.error("Update failed:", err);
    res.status(500).json({ error: "Update failed" });
  }
}
