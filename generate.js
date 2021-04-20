const fs = require('fs');

const mkdirp = require('mkdirp');
const RSSParser = require('rss-parser');
const ffmpeg = require('fluent-ffmpeg');
const nodeHtmlToImage = require('node-html-to-image');

const SLATE_TEMPLATE = './templates/slate.html';
const THUMBNAIL_TEMPLATE = './templates/thumbnail.html';
const FFMPEG_PATH = './bin/ffmpeg';

const args = process.argv.slice(2)

const RSS_URL = args[0];
const EPISODE = args[1];

(async () => {

  let now = Math.floor(Date.now() / 1000)
  let parser = new RSSParser();

  let feed = await parser.parseURL(RSS_URL);

  let item = feed.items.find(i => i.itunes.episode == EPISODE);

  if (!item) {
    return;
  }

  let outputDir = `./out/${now} - ${item.title}`;

  mkdirp.sync(outputDir);

  // generar thumbnail

  const thumbnailHTML = fs.readFileSync(THUMBNAIL_TEMPLATE, 'utf8')
  const thumbnailPath = `${outputDir}/thumbnail.png`;
  await nodeHtmlToImage({
    output: thumbnailPath,
    html: thumbnailHTML,
    puppeteerArgs: {
      defaultViewport: {
        width: 1920,
        height: 1080,
      }
    },
    content: {
      item: item,
      channel: feed,
    },
  });

  // generar slate

  const slateHTML = fs.readFileSync(SLATE_TEMPLATE, 'utf8')
  const slatePath = `${outputDir}/slate.png`;
  await nodeHtmlToImage({
    output: slatePath,
    html: slateHTML,
    puppeteerArgs: {
      defaultViewport: {
        width: 1920,
        height: 1080,
      }
    },
    content: {
      item: item,
      channel: feed,
    },
  });

  // generar descripción
  fs.writeFileSync(`${outputDir}/description.txt`, item.title + "\n\n" + item.contentSnippet);

  // generar video

  let slateGen = ffmpeg();

  let slateGenDone = await new Promise((res, rej) => {
    slateGen
      .setFfmpegPath(FFMPEG_PATH)
      .input(slatePath).loop()
      .videoCodec('libx264')
      .duration(15)
      .save(`${outputDir}/slate.mp4`)
      .on('end', (err, stdout, stderr) => {
        if (err) {
          rej(err);
        } else {
          res(true);
        }
      })
  })

  var videoGen = ffmpeg();

  videoGen
    .setFfmpegPath(FFMPEG_PATH)
    .input(item.enclosure.url)
    .input(`${outputDir}/slate.mp4`)
    .videoCodec('copy')
    .audioCodec('copy')
    .save(`${outputDir}/video.mp4`);


})();
