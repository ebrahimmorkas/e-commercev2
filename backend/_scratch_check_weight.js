require('dotenv').config({ quiet: true });
const common = require('./utils/common');
const mongoose = require('mongoose');

const encoded = 'gmQdjXHDfvRMq_31WfSY3FfQ02feK8JscRtTNFaN9Xw';
console.log('encoded length:', encoded.length);
const decoded = common.decodeId(encoded);
console.log('decoded:', decoded);

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const wm = await mongoose.connection.db.collection('weightmasters').findOne({ _id: new mongoose.Types.ObjectId(decoded) });
  console.log('WeightMaster doc:', wm);

  // Also check the product's raw stored weight.unit directly from DB
  const product = await mongoose.connection.db.collection('products').findOne({ productCode: 'PRD-000019' });
  console.log('raw stored weight:', JSON.stringify(product.variants[0].sizes[0].weight));

  process.exit(0);
}).catch(e => { console.log('connect error', e.message); process.exit(1); });
