const mongoose = require('mongoose');

const processExcelRows = async (rows, processRowFn, options = {}) => {
    const allowPartialSuccess = options.allowPartialSuccess !== false;
    const useTransaction = options.useTransaction === true; // default OFF now

    let session = null;
    if (useTransaction) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        const result = {
            totalRows: rows.length,
            successCount: 0,
            failedCount: 0,
            failedLineNumbers: [],
            failedRecords: [],
            committed: true // meaningful only when useTransaction is true
        };

        for (const row of rows) {
            try {
                const rowResult = await processRowFn(row, session); // session is null when useTransaction=false

                if (rowResult && rowResult.success === false) {
                    result.failedCount++;
                    result.failedLineNumbers.push(row.__rowNumber);
                    result.failedRecords.push({
                        rowNumber: row.__rowNumber,
                        data: row,
                        errors: rowResult.errors && rowResult.errors.length ? rowResult.errors : ['Validation failed']
                    });
                } else {
                    result.successCount++;
                }
            } catch (err) {
                result.failedCount++;
                result.failedLineNumbers.push(row.__rowNumber);
                result.failedRecords.push({
                    rowNumber: row.__rowNumber,
                    data: row,
                    errors: [err.message || 'Unexpected error while processing row']
                });
            }
        }

        if (useTransaction) {
            const shouldCommit = allowPartialSuccess || result.failedCount === 0;
            if (shouldCommit) {
                await session.commitTransaction();
                result.committed = true;
            } else {
                await session.abortTransaction();
                result.committed = false;
            }
        }

        return result;
    } catch (err) {
        if (useTransaction && session) {
            await session.abortTransaction();
        }
        throw err;
    } finally {
        if (useTransaction && session) {
            session.endSession();
        }
    }
};

module.exports = { processExcelRows };