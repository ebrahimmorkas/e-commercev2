// Single source of truth for all image-storage provider credentials.
// One set of credentials per provider, read from .env (see .env.example.imageUpload).

const imageProviderConfig = {
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        bucket: process.env.AWS_S3_BUCKET
    },
    r2: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        accountId: process.env.R2_ACCOUNT_ID,
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT, // e.g. https://<accountId>.r2.cloudflarestorage.com
        publicUrl: process.env.R2_PUBLIC_URL // e.g. https://media.yourdomain.com
    },
    local: {
        basePath: process.env.LOCAL_STORAGE_BASE_PATH || 'uploads',
        baseUrl: process.env.LOCAL_STORAGE_BASE_URL || 'http://localhost:5000/uploads'
    }
};

module.exports = imageProviderConfig;