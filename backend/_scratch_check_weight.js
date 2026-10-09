require('dotenv').config({ quiet: true });
const common = require('./utils/common');
const mongoose = require('mongoose');

const encoded = 'gmQdjXHDfvRMq_31WfSY3FfQ02feK8JscRtTNFaN9Xw';
const decoded = common.decodeId(encoded);

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const wm = await mongoose.connection.db.collection('weightmasters').findOne({ _id: new mongoose.Types.ObjectId(decoded) });

  // Also check the product's raw stored weight.unit directly from DB
  const product = await mongoose.connection.db.collection('products').findOne({ productCode: 'PRD-000019' });

  process.exit(0);
}).catch(() => { process.exit(1); });
