const core = require('@actions/core');
const exec = require('@actions/exec');
const AWS = require('aws-sdk');
const fs = require('graceful-fs');
const _7z = require('7zip-min');

function pack(...args) {
  return new Promise(function (resolve, reject) {
    _7z.pack(...args, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function unpack(...args) {
  return new Promise(function (resolve, reject) {
    _7z.unpack(...args, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function run() {
  try {
    const s3Bucket = core.getInput('s3-bucket', { required: true });
    const cacheKey = core.getInput('cache-key', { required: true });
    const paths = core.getInput('paths', { required: true });
    const command = core.getInput('command', { required: true });
    const workingDirectory = core.getInput('working-directory', { required: false });
    const fileName = cacheKey + '.7z';

    process.chdir(workingDirectory);

    const s3 = new AWS.S3();

    s3.getObject({
        Bucket: s3Bucket,
        Key:fileName
      }, async (err, data) => {
        if (err) {
          console.log(`No cache is found for key: ${fileName}`);

          await exec.exec(command); // install or build command e.g. npm ci, npm run dev
          await pack(paths, fileName);

          s3.upload({
              Body: fs.readFileSync(fileName),
              Bucket: s3Bucket,
              Key: fileName,
            }, (err, data) => {
              if (err) {
                console.log(`Failed store to ${fileName}`);
              } else {
                console.log(`Stored cache to ${fileName}`);
              }
            }
          );

        } else {
          console.log(`Found a cache for key: ${fileName}`);
          fs.writeFileSync(fileName, data.Body);

          await unpack(fileName);
          await exec.exec(`rm -f ${fileName}`);
        }
    });

  }
  catch (error) {
    core.setFailed(error.message)
  }
}

run();
