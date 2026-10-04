const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { BSON } = mongoose.mongo;

// A mongodump .bson file is just the collection's documents written one after
// another, each starting with its own 4-byte length - so it can be read
// directly, with no need to restore the dump into a database first.
// Returned oldest first (an ObjectId sorts by creation time).
const readCollection = (backupDir, collectionName) => {
    try {
        const filePath = path.join(backupDir, `${collectionName}.bson`);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Backup file not found: ${filePath}`);
        }

        const buffer = fs.readFileSync(filePath);
        const documents = [];
        let offset = 0;

        while (offset < buffer.length) {
            const size = buffer.readInt32LE(offset);
            if (size <= 0 || offset + size > buffer.length) {
                throw new Error(`${filePath} is truncated or corrupt at byte ${offset}.`);
            }
            documents.push(BSON.deserialize(buffer.subarray(offset, offset + size)));
            offset += size;
        }

        documents.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

        return documents;
    } catch (err) {
        throw err;
    }
};

// Applies --limit / --ids to the backup: the first `limit` records plus any
// record named in `ids`. With neither option the whole collection is selected.
const selectRecords = (documents, { limit, ids }) => {
    try {
        if (limit === null && ids.length === 0) {
            return documents;
        }
        const wanted = new Set(ids);
        return documents.filter((doc, index) => (limit !== null && index < limit) || wanted.has(doc._id.toString()));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    readCollection,
    selectRecords
};
