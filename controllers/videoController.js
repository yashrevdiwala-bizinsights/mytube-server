import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"

import { pool } from "../utils/db.js"

export const getAllVideos = async (req, res) => {
  const promiseConnection = await pool.promise().getConnection()

  try {
    const [videos] = await promiseConnection.query("SELECT * FROM tbl_videos")

    res.status(200).json({ videos })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  } finally {
    promiseConnection.release()
  }
}

export const getVideo = async (req, res) => {
  const promiseConnection = await pool.promise().getConnection()

  try {
    const { id } = req.params

    if (!id) throw new Error("Video ID is required")

    const [video] = await promiseConnection.query("SELECT * FROM tbl_videos WHERE id = ?", [id])

    if (!video.length) throw new Error("Video not found")

    return res.status(200).json({ message: "Video fetched Successfully", video: video[0] })
  } catch (error) {
    console.log(error.message)

    return res.status(500).json({ error: error.message })
  } finally {
    promiseConnection.release()
  }
}

export const uploadVideo = async (req, res) => {
  const promiseConnection = await pool.promise().getConnection()

  try {
    const { file } = req

    if (!file) throw new Error("Please upload a file")

    const { originalname, path: inputFile, destination } = file

    const output1080 = path.join(destination, "1080p.m3u8")
    const output720 = path.join(destination, "720p.m3u8")
    const output480 = path.join(destination, "480p.m3u8")
    const masterPlaylist = path.join(destination, "index.m3u8")

    ffmpeg(inputFile)
      // 1080p output
      .output(output1080)
      .outputOptions([
        "-vf",
        "scale=w=1920:h=1080", // adjust resolution if needed
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-c:v",
        "libx264",
        "-profile:v",
        "main",
        "-crf",
        "20", // quality setting
        "-sc_threshold",
        "0",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-hls_time",
        "10",
        "-hls_playlist_type",
        "vod",
        "-b:v",
        "5000k",
      ])
      // 720p output
      .output(output720)
      .outputOptions([
        "-vf",
        "scale=w=1280:h=720",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-c:v",
        "libx264",
        "-profile:v",
        "main",
        "-crf",
        "23",
        "-sc_threshold",
        "0",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-hls_time",
        "10",
        "-hls_playlist_type",
        "vod",
        "-b:v",
        "3000k",
      ])
      // 480p output
      .output(output480)
      .outputOptions([
        "-vf",
        "scale=w=854:h=480",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-c:v",
        "libx264",
        "-profile:v",
        "main",
        "-crf",
        "26",
        "-sc_threshold",
        "0",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-hls_time",
        "10",
        "-hls_playlist_type",
        "vod",
        "-b:v",
        "1500k",
      ])
      .on("end", async () => {
        const masterContent = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080",
          "1080p.m3u8",
          "#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720",
          "720p.m3u8",
          "#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480",
          "480p.m3u8",
        ].join("\n")

        fs.writeFileSync(masterPlaylist, masterContent)

        const [results] = await promiseConnection.query(
          "INSERT INTO tbl_videos (videoTitle, videoPath) VALUES (?, ?)",
          [originalname, masterPlaylist]
        )

        if (results.affectedRows && results.insertId) {
          fs.rm(inputFile, { force: true }, (error) => {
            if (error) throw new Error(error.message)
          })

          fs.unlinkSync(inputFile)

          return res.status(200).json({
            message: "Video uploaded successfully",
            videoPath: masterPlaylist,
            results,
          })
        }
      })
      .on("error", (error) => {
        fs.rmdir(destination, { recursive: true, force: true }, (error) => {
          if (error) throw new Error(error.message)
        })

        try {
          fs.unlinkSync(inputFile)
        } catch (err) {
          console.error("Error deleting input file:", err.message)
        }

        throw new Error(error.message)
      })
      .run()
  } catch (error) {
    return res.status(500).json({ error: error.message })
  } finally {
    promiseConnection.release()
  }
}
