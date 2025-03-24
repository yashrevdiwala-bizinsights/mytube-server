import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"

import { pool } from "../utils/db.js"

// Define all available presets
const presets = [
  {
    name: "4k",
    width: 3840,
    height: 2160,
    crf: "18",
    bitrate: "12000k",
    scale: "scale=w=3840:h=2160",
  },
  {
    name: "2k",
    width: 2560,
    height: 1440,
    crf: "20",
    bitrate: "7500k",
    scale: "scale=w=2560:h=1440",
  },
  {
    name: "1080p",
    width: 1920,
    height: 1080,
    crf: "20",
    bitrate: "5000k",
    scale: "scale=w=1920:h=1080",
  },
  {
    name: "720p",
    width: 1280,
    height: 720,
    crf: "23",
    bitrate: "3000k",
    scale: "scale=w=1280:h=720",
  },
  {
    name: "480p",
    width: 854,
    height: 480,
    crf: "26",
    bitrate: "1500k",
    scale: "scale=w=854:h=480",
  },
  {
    name: "360p",
    width: 640,
    height: 360,
    crf: "28",
    bitrate: "1000k",
    scale: "scale=w=640:h=360",
  },
  {
    name: "144p",
    width: 256,
    height: 144,
    crf: "32",
    bitrate: "300k",
    scale: "scale=w=256:h=144",
  },
]

export const getAllVideos = async (req, res) => {
  const promiseConnection = await pool.promise().getConnection()

  try {
    const [videos] = await promiseConnection.query("SELECT * FROM tbl_videos ORDER BY id DESC")

    if (!videos.length) throw new Error("No videos found")

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
    const { title } = req.body

    if (!file) throw new Error("Please upload a file")

    const { originalname, path: inputFile, destination } = file

    const videoTitle = title || originalname

    // Determine output file paths for each preset
    // We will dynamically create the outputs based on the preset name
    const outputFiles = {}

    presets.forEach((preset) => {
      outputFiles[preset.name] = path.join(destination, `${preset.name}.m3u8`)
    })

    const masterPlaylist = path.join(destination, "index.m3u8")

    // Use ffprobe to get original video resolution
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputFile, (err, metadata) => {
        if (err) reject(new Error("Error retrieving video metadata: " + err.message))
        else resolve(metadata)
      })
    })

    // Find the video stream
    const videoStream = metadata.streams.find((stream) => stream.codec_type === "video")

    if (!videoStream) throw new Error("No video stream found")

    const origWidth = videoStream.width
    const origHeight = videoStream.height

    // Filter out presets higher than the original file quality
    const applicablePresets = presets.filter((preset) => origWidth >= preset.width && origHeight >= preset.height)

    if (applicablePresets.length === 0) {
      return res.status(400).json({ flag: 0, message: "Uploaded video quality is too low for processing" })
    }

    // Process video using ffmpeg (wrapped in Promise)
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputFile)

      applicablePresets.forEach((preset) => {
        command = command
          .output(outputFiles[preset.name])
          .outputOptions([
            "-threads",
            "4",
            "-vf",
            preset.scale,
            "-c:a",
            "aac",
            "-ar",
            "48000",
            "-c:v",
            "libx264",
            "-profile:v",
            "main",
            "-crf",
            preset.crf,
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
            preset.bitrate,
          ])
      })

      command
        .on("end", resolve)
        .on("error", (error) => {
          reject(new Error("FFmpeg error: " + error.message))
        })
        .run()
    })

    // Build the master playlist dynamically
    let masterContent = "#EXTM3U\n#EXT-X-VERSION:3\n"
    applicablePresets.forEach((preset) => {
      let bandwidth =
        {
          "4k": 12000000,
          "2k": 7500000,
          "1080p": 5000000,
          "720p": 3000000,
          "480p": 1500000,
          "360p": 1000000,
          "144p": 300000,
        }[preset.name] || 1500000

      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${preset.width}x${preset.height}\n`
      masterContent += `${preset.name}.m3u8\n`
    })

    fs.writeFileSync(masterPlaylist, masterContent)

    // Insert into database **AFTER processing completes**
    const [results] = await promiseConnection.query("INSERT INTO tbl_videos (videoTitle, videoPath) VALUES (?, ?)", [
      videoTitle,
      masterPlaylist,
    ])

    if (results.affectedRows && results.insertId) {
      // Remove input file after processing
      fs.rm(inputFile, { force: true }, (error) => {
        if (error) console.error("Error removing input file:", error.message)
      })

      return res.status(200).json({
        flag: 1,
        message: "Video uploaded successfully",
        videoPath: masterPlaylist,
        results,
      })
    }
  } catch (error) {
    return res.status(500).json({ error: error.message })
  } finally {
    promiseConnection.release()
  }
}
