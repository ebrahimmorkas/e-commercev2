const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const videoProviderConfig = require('../../config/videoProviderConfig');

const { basePath, baseUrl } = videoProviderConfig.local;

// filePath -> { url, key }
// Moves the already-on-disk temp file into its final location instead of
// reading it into a buffer first (the temp file already holds the bytes).
const upload = async (filePath, meta) => {
    const relativeDir = path.join(String(meta.vendorId), meta.module);
    const fileName = `${randomUUID()}-${meta.originalName}`;
    const relativePath = path.join(relativeDir, fileName);

    const absoluteDir = path.join(basePath, relativeDir);
    const absolutePath = path.join(basePath, relativePath);

    await fs.mkdir(absoluteDir, { recursive: true });
    try {
        await fs.rename(filePath, absolutePath);
    } catch (err) {
        // EXDEV: temp dir and storage dir are on different mounts/drives - rename
        // can't do a cross-device move, so fall back to copy + delete original.
        if (err.code !== 'EXDEV') throw err;
        await fs.copyFile(filePath, absolutePath);
        await fs.unlink(filePath);
    }

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
