const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const yauzl = require('yauzl');

/*
| Reads a zip that sits on DISK one entry at a time - for zips far too big to
| hold in memory (the bulk product videos zip). utils/zipExtractor.js (adm-zip)
| loads the whole zip into memory and stays the choice for image zips.
|
| Entry names are matched case-insensitively against the full path inside
| the zip (forward slashes), the same way extractZipEntries keys its map.
*/

const openZip = (zipPath) => new Promise((resolve, reject) => {
    try {
        yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (err, zipFile) => {
            if (err) return reject(err);
            resolve(zipFile);
        });
    } catch (err) {
        reject(err);
    }
});

// lowercased entry name -> yauzl entry (directories skipped).
const readEntries = (zipFile) => new Promise((resolve, reject) => {
    try {
        const entries = new Map();
        zipFile.on('entry', (entry) => {
            if (!/\/$/.test(entry.fileName)) entries.set(entry.fileName.toLowerCase(), entry);
            zipFile.readEntry();
        });
        zipFile.on('end', () => resolve(entries));
        zipFile.on('error', reject);
        zipFile.readEntry();
    } catch (err) {
        reject(err);
    }
});

const openEntryStream = (zipFile, entry) => new Promise((resolve, reject) => {
    try {
        zipFile.openReadStream(entry, (err, stream) => {
            if (err) return reject(err);
            resolve(stream);
        });
    } catch (err) {
        reject(err);
    }
});

/**
 * Opens a zip on disk and lists its entries.
 * @param {string} zipPath
 * @returns {Promise<{ has(name: string): boolean, sizeOf(name: string): number|null,
 *   extractToFile(name: string, destinationPath: string): Promise<number>, close(): void }>}
 */
const openZipFileReader = async (zipPath) => {
    try {
        const zipFile = await openZip(zipPath);
        const entries = await readEntries(zipFile);

        const findEntry = (name) => {
            try {
                return entries.get(String(name || '').toLowerCase()) || null;
            } catch (err) {
                throw err;
            }
        };

        return {
            has: (name) => {
                try {
                    return !!findEntry(name);
                } catch (err) {
                    throw err;
                }
            },
            sizeOf: (name) => {
                try {
                    const entry = findEntry(name);
                    return entry ? entry.uncompressedSize : null;
                } catch (err) {
                    throw err;
                }
            },
            // Streams one entry into destinationPath; resolves with the bytes written.
            extractToFile: async (name, destinationPath) => {
                try {
                    const entry = findEntry(name);
                    if (!entry) throw new Error(`"${name}" was not found in the zip.`);
                    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
                    const stream = await openEntryStream(zipFile, entry);
                    await pipeline(stream, fs.createWriteStream(destinationPath));
                    const stats = await fs.promises.stat(destinationPath);
                    return stats.size;
                } catch (err) {
                    throw err;
                }
            },
            close: () => {
                try {
                    zipFile.close();
                } catch (err) {
                    throw err;
                }
            }
        };
    } catch (err) {
        throw err;
    }
};

module.exports = { openZipFileReader };
