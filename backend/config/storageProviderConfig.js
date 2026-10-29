// The PLATFORM's own storage accounts (the website owner's), read from .env.
// One account per provider, shared by images, videos and files.
//
// A vendor normally uploads to their OWN account (CompanyMaster.storageCredentials).
// These are only used when WebsiteMaster forces every vendor onto a provider
// the vendor did not choose themselves (enforceMain*Service), when the vendor
// has no own fileService, and to delete files uploaded before per-vendor
// accounts existed - see services/storageCredentialsService.js.
//
// local has no account: it is this server's own disk, shared by every vendor
// (each vendor's files sit under their own <vendorId>/ folder).

const storageProviderConfig = {
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
    imagekit: {
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT, // e.g. https://ik.imagekit.io/<imagekitId>
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY
    },
    local: {
        basePath: process.env.LOCAL_STORAGE_BASE_PATH || 'uploads',
        baseUrl: process.env.LOCAL_STORAGE_BASE_URL || 'http://localhost:5000/uploads'
    }
};

module.exports = storageProviderConfig;
