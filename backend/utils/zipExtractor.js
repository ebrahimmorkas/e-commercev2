const AdmZip = require('adm-zip');

/**
 * Extracts a zip buffer in-memory into a Map of relativePath -> Buffer.
 * Skips directory entries. Matching is EXACT and case-sensitive against
 * entry.entryName as stored in the zip (forward slashes) - no normalization,
 * per the strict-path-match requirement.
 *
 * @param {Buffer} zipBuffer
 * @returns {Map<string, Buffer>}
 */
const extractZipEntries = (zipBuffer) => {
    if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) {
        throw new Error('A valid zip buffer is required');
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const fileMap = new Map();
    entries.forEach((entry) => {
        if (entry.isDirectory) return;
        fileMap.set(entry.entryName.toLowerCase(), entry.getData()); // lowercase key
    });

    return fileMap;
};

// Packs a set of in-memory buffers into a NEW zip buffer. Used when we need
// to hand a group of buffers to something that only accepts "one zip file"
// (e.g. createProduct's per-size additional-images upload path).
// entries: [{ name: string, buffer: Buffer }]
const createZipBuffer = (entries) => {
    const zip = new AdmZip();
    for (const entry of entries) {
        zip.addFile(entry.name, entry.buffer);
    }
    return zip.toBuffer();
};

module.exports = { 
    extractZipEntries,
    createZipBuffer 
};