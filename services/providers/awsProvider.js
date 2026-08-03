const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');
const imageProviderConfig = require('../../config/imageProviderConfig');

const { accessKeyId, secretAccessKey, region, bucket } = imageProviderConfig.aws;

const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
});

// buffer -> { url, key }
const upload = async (buffer, meta) => {
    const key = `${meta.vendorId}/${meta.module}/${randomUUID()}-${meta.originalName}`;

    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: meta.mimeType
    }));

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