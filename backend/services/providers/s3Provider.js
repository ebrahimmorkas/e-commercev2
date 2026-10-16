const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { randomUUID } = require('crypto');
const fs = require('fs');
const { STORAGE_PROVIDERS } = require('../../constants/storageConstants');

// AWS S3 and Cloudflare R2 adapters (same API, only the client and the public
// URL differ). The account is passed in on every call - the vendor's own or
// the platform's, see storageCredentialsService - so a client is built for the
// call and destroyed afterwards rather than one shared client bound to a
// single .env account.
//
// Interface (same as every other provider adapter):
//   upload(bufferOrFilePath, meta, credentials) -> Promise<{ url, key }>
//   delete(key, credentials) -> Promise<void>

const createClient = (provider, credentials) => {
    try {
        const s3Credentials = {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey
        };

        if (provider === STORAGE_PROVIDERS.R2) {
            return new S3Client({
                region: 'auto',
                endpoint: credentials.endpoint || `https://${credentials.accountId}.r2.cloudflarestorage.com`,
                credentials: s3Credentials
            });
        }

        return new S3Client({
            region: credentials.region,
            credentials: s3Credentials
        });
    } catch (err) {
        throw err;
    }
};

const buildObjectUrl = (provider, credentials, key) => {
    try {
        if (provider === STORAGE_PROVIDERS.R2) {
            return `${String(credentials.publicUrl).replace(/\/+$/, '')}/${key}`;
        }
        return `https://${credentials.bucket}.s3.${credentials.region}.amazonaws.com/${key}`;
    } catch (err) {
        throw err;
    }
};

const buildObjectKey = (meta) => {
    try {
        return `${meta.vendorId}/${meta.module}/${randomUUID()}-${meta.originalName}`;
    } catch (err) {
        throw err;
    }
};

const deleteObject = async (provider, key, credentials) => {
    const client = createClient(provider, credentials);
    try {
        await client.send(new DeleteObjectCommand({
            Bucket: credentials.bucket,
            Key: key
        }));
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
};

// Images and files: the whole buffer in one PutObject.
const createBufferProvider = (provider) => {
    try {
        const upload = async (buffer, meta, credentials) => {
            const client = createClient(provider, credentials);
            try {
                const key = buildObjectKey(meta);
                await client.send(new PutObjectCommand({
                    Bucket: credentials.bucket,
                    Key: key,
                    Body: buffer,
                    ContentType: meta.mimeType
                }));
                return { url: buildObjectUrl(provider, credentials, key), key };
            } catch (err) {
                throw err;
            } finally {
                client.destroy();
            }
        };

        const deleteFile = async (key, credentials) => {
            try {
                await deleteObject(provider, key, credentials);
            } catch (err) {
                throw err;
            }
        };

        return { upload, delete: deleteFile };
    } catch (err) {
        throw err;
    }
};

// Videos: streamed off disk in parts by the multipart Upload helper instead of
// being buffered whole in memory.
const createVideoProvider = (provider) => {
    try {
        const upload = async (filePath, meta, credentials) => {
            const client = createClient(provider, credentials);
            try {
                const key = buildObjectKey(meta);
                const uploader = new Upload({
                    client,
                    params: {
                        Bucket: credentials.bucket,
                        Key: key,
                        Body: fs.createReadStream(filePath),
                        ContentType: meta.mimeType
                    }
                });
                await uploader.done();
                return { url: buildObjectUrl(provider, credentials, key), key };
            } catch (err) {
                throw err;
            } finally {
                client.destroy();
            }
        };

        const deleteFile = async (key, credentials) => {
            try {
                await deleteObject(provider, key, credentials);
            } catch (err) {
                throw err;
            }
        };

        return { upload, delete: deleteFile };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createBufferProvider,
    createVideoProvider
};
