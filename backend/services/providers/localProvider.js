const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

// This server's own disk. "credentials" here is just { basePath, baseUrl }
// (config/storageProviderConfig.js) - local has no account; every vendor's
// files sit under their own <vendorId>/ folder.

// buffer -> { url, key }
const upload = async (buffer, meta, credentials) => {
    try {
        const { basePath, baseUrl } = credentials;
        const relativeDir = path.join(String(meta.vendorId), meta.module);
        const fileName = `${randomUUID()}-${meta.originalName}`;
        const relativePath = path.join(relativeDir, fileName);

        const absoluteDir = path.join(basePath, relativeDir);
        const absolutePath = path.join(basePath, relativePath);

        await fs.mkdir(absoluteDir, { recursive: true });
        await fs.writeFile(absolutePath, buffer);

        // key stores the relative path so we can locate/delete the file later
        const key = relativePath.split(path.sep).join('/');
        const url = `${baseUrl}/${key}`;

        return { url, key };
    } catch (err) {
        throw err;
    }
};

const deleteFile = async (key, credentials) => {
    const absolutePath = path.join(credentials.basePath, key);
    try {
        await fs.unlink(absolutePath);
    } catch (err) {
        // If the file is already gone, treat as a no-op rather than failing the whole operation.
        if (err.code !== 'ENOENT') throw err;
    }
};

module.exports = {
    upload,
    delete: deleteFile
};
