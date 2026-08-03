const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const imageProviderConfig = require('../../config/imageProviderConfig');

const { basePath, baseUrl } = imageProviderConfig.local;

// buffer -> { url, key }
const upload = async (buffer, meta) => {
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
};

const deleteFile = async (key) => {
    const absolutePath = path.join(basePath, key);
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