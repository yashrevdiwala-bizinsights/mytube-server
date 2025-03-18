import { Router } from "express"

import { upload } from "../middlewares/fileUpload.js"
import {
  getAllVideos,
  getVideo,
  uploadVideo,
} from "../controllers/videoController.js"

export const videoRoutes = Router()

videoRoutes.get("/", getAllVideos)
videoRoutes.get("/get/:id", getVideo)
videoRoutes.post("/upload", upload.single("video"), uploadVideo)
