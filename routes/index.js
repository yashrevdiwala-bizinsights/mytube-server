import { Router } from "express"

import { videoRoutes } from "./video.js"

export const routes = Router()

routes.use("/video", videoRoutes)
