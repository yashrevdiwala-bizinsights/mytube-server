import multer from "multer"
import path from "path"
import fs from "fs"
import { v4 as uuidv4 } from "uuid"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uId = uuidv4()
    req.uId = uId
    const dir = `public/${uId}`

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const uniqueId = req.uId
    cb(null, file.fieldname + "-" + uniqueId + path.extname(file.originalname))
  },
})

export const upload = multer({ storage })
