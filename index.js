import express from "express"
import cors from "cors"
import "dotenv/config"

import "./utils/db.js"
import { routes } from "./routes/index.js"

const app = express()

app.use(
  cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use("/public", express.static("public"))

app.use("/", routes)

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`)
})
