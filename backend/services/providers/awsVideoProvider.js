const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { randomUUID } = require('crypto');
const fs = require('fs');
const videoProviderConfig = require('../../config/videoProviderConfig');

const { accessKeyId, secretAccessKey, region, bucket } = videoProviderConfig.aws;

const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
});

// filePath -> { url, key }
// Uses the multipart-streaming Upload helper (not a single PutObjectCommand)
// so a large video file is streamed off disk in parts instead of being
// buffered whole in memory.
const upload = async (filePath, meta) => {
    const key = `${meta.vendorId}/${meta.module}/${randomUUID()}-${meta.originalName}`;

    const uploader = new Upload({
        client,
        params: {
            Bucket: bucket,
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentType: meta.mimeType
        }
    });
    await uploader.done();

    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { url, key };
};

const deleteFile = async (key) => {
    await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
    }));
};

module.exports = {
    upload,
    delete: deleteFile
};
