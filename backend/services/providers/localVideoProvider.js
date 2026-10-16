const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const localProvider = require('./localProvider');

// This server's own disk - "credentials" is just { basePath, baseUrl }, see localProvider.js.

// filePath -> { url, key }
// Moves the already-on-disk temp file into its final location instead of
// reading it into a buffer first (the temp file already holds the bytes).
const upload = async (filePath, meta, credentials) => {
    try {
        const { basePath, baseUrl } = credentials;
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
    } catch (err) {
        throw err;
    }
};

module.exports = {
    upload,
    delete: localProvider.delete
};
