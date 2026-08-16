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

module.exports = { extractZipEntries };