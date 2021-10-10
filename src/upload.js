let express = require("express");
let formidable = require("formidable");
let ffprobe = require("ffprobe");
let fs = require("fs/promises");
let path = require("path");
let { videoDirectory, ffprobePath } = require("../config.json");

let router = express.Router();

router.post("/upload", async (req, res, next) => {
  try {
    let formData = await parseFormData(req);
    let expirationMinutes = formData.fields.expirationMinutes;
    let video = formData.files.video;
    if (!validExpirationMinutes(expirationMinutes)) {
      await cleanUpVideo(video);
      res
        .status(400)
        .render("text", { texts: ["Invalid expiration minutes."] });
    } else if (!(await validVideo(video))) {
      await cleanUpVideo(video);
      res.status(400).render("text", { texts: ["Invalid video."] });
    } else {
      await moveToVideoDirectory(video);
      res.redirect(path.basename(video.path));
    }
  } catch (error) {
    next(error);
  }
});

function parseFormData(req) {
  return new Promise((resolve, reject) => {
    let form = formidable();
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          fields: fields,
          files: files,
        });
      }
    });
  });
}

async function cleanUpVideo(video) {
  if (video) {
    await fs.unlink(video.path);
  }
}

function validExpirationMinutes(expirationMinutes) {
  expirationMinutes = parseInt(expirationMinutes, 10);
  if (expirationMinutes === 10 || expirationMinutes === 30) {
    return true;
  }

  return false;
}

async function validVideo(video) {
  try {
    if (video) {
      let info = await ffprobe(video.path, { path: ffprobePath });
      for (let stream of info.streams) {
        if (stream.codec_type === "video" && stream.avg_frame_rate !== "0/0") {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function moveToVideoDirectory(video) {
  try {
    let fileName = path.basename(video.path);
    let newPath = path.join(videoDirectory, fileName);
    await fs.mkdir(videoDirectory, { recursive: true });
    await fs.rename(video.path, newPath);
  } catch (error) {
    console.error("error: failed to move video into the video directory");
    throw error;
  }
}

module.exports = {
  ...module.exports,
  router,
  validExpirationMinutes,
  validVideo,
};
