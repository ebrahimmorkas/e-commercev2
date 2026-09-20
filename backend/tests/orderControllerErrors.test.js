const test = require('node:test');
const assert = require('node:assert/strict');

// Requiring the controller pulls in mongoose models but opens no connection, so this stays a pure unit test.
const orderService = require('../services/orderService');
const orderEditService = require('../services/orderEditService');
const orderController = require('../controllers/orderController');

// A handler whose catch only logs leaves the HTTP request open forever (the client's spinner never
// stops). Every order handler must answer with a 500 when the service throws.
const fakeRes = () => {
    const res = { statusCode: null, body: null, headersSent: false };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; res.headersSent = true; return res; };
    return res;
};

const fakeReq = () => ({
    vendorId: 'vendor1',
    user: { _id: 'admin1' },
    params: { id: 'order1' },
    query: {},
    body: {},
    websiteMasterData: {},
    companyMasterData: {},
    companySettingsData: {}
});

const boom = async () => { throw new Error('boom'); };

test('advanceOrderStep answers 500 (not silence) when the service throws', async () => {
    const original = orderService.advanceOrderStep;
    orderService.advanceOrderStep = boom;
    try {
        const res = fakeRes();
        await orderController.advanceOrderStep(fakeReq(), res);
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.success, false);
    } finally {
        orderService.advanceOrderStep = original;
    }
});

test('the shipping-price and edit-order handlers answer 500 too', async () => {
    const originals = {
        updateOrderShippingPrice: orderService.updateOrderShippingPrice,
        setOrderShippingPrice: orderService.setOrderShippingPrice,
        addProductsToOrder: orderEditService.addProductsToOrder
    };
    orderService.updateOrderShippingPrice = boom;
    orderService.setOrderShippingPrice = boom;
    orderEditService.addProductsToOrder = boom;
    try {
        // The edit-feature gates read the master data; with both flags on they reach the service.
        const req = fakeReq();
        req.websiteMasterData = { isEditingShippingPriceFeatureOn: true, isEditingOrderFeatureOn: true };
        req.companyMasterData = { isEditingShippingPriceFeatureOn: true, isEditingOrderFeatureOn: true };
        req.body = { shippingAmount: 5, items: [] };

        for (const handler of ['setOrderShippingPrice', 'updateOrderShippingPrice', 'addProductsToOrder']) {
            const res = fakeRes();
            await orderController[handler](req, res);
            assert.equal(res.statusCode, 500, `${handler} did not answer with 500`);
        }
    } finally {
        Object.assign(orderService, { updateOrderShippingPrice: originals.updateOrderShippingPrice, setOrderShippingPrice: originals.setOrderShippingPrice });
        orderEditService.addProductsToOrder = originals.addProductsToOrder;
    }
});

test('a response that has already started is not answered a second time', async () => {
    const original = orderService.advanceOrderStep;
    orderService.advanceOrderStep = boom;
    try {
        const res = fakeRes();
        res.headersSent = true;
        await orderController.advanceOrderStep(fakeReq(), res);
        assert.equal(res.statusCode, null);
    } finally {
        orderService.advanceOrderStep = original;
    }
});
