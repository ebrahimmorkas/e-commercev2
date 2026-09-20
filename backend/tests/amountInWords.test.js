const test = require('node:test');
const assert = require('node:assert/strict');
const { amountInWords } = require('../utils/amountInWords');

test('spells whole and fractional amounts like the Tally sample bill', () => {
    assert.equal(amountInWords(6914, 'AED'), 'Six Thousand Nine Hundred Fourteen UAE Dirham Only');
    assert.equal(amountInWords(329.31, 'AED'), 'Three Hundred Twenty Nine UAE Dirham and Thirty One fils Only');
});

test('handles zero, teens, hundreds and thousands boundaries', () => {
    assert.equal(amountInWords(0, 'AED'), 'Zero UAE Dirham Only');
    assert.equal(amountInWords(0.5, 'AED'), 'Zero UAE Dirham and Fifty fils Only');
    assert.equal(amountInWords(1, 'AED'), 'One UAE Dirham Only');
    assert.equal(amountInWords(21, 'AED'), 'Twenty One UAE Dirham Only');
    assert.equal(amountInWords(100, 'AED'), 'One Hundred UAE Dirham Only');
    assert.equal(amountInWords(1001, 'AED'), 'One Thousand One UAE Dirham Only');
    assert.equal(amountInWords(1000000, 'AED'), 'One Million UAE Dirham Only');
});

test('uses lakh/crore grouping for INR and three decimals for KWD', () => {
    assert.equal(amountInWords(106260.6, 'INR'), 'One Lakh Six Thousand Two Hundred Sixty Indian Rupees and Sixty paise Only');
    assert.equal(amountInWords(12500000, 'INR'), 'One Crore Twenty Five Lakh Indian Rupees Only');
    assert.equal(amountInWords(10.126, 'KWD', 3), 'Ten Kuwaiti Dinar and One Hundred Twenty Six fils Only');
});

test('never drops the fractional part for a currency it has no wording for', () => {
    assert.equal(amountInWords(45.5, 'XYZ'), 'Forty Five XYZ and 50/100 Only');
    assert.equal(amountInWords(45.05, 'XYZ'), 'Forty Five XYZ and 05/100 Only');
});

test('treats negative and missing amounts as zero', () => {
    assert.equal(amountInWords(-5, 'AED'), 'Zero UAE Dirham Only');
    assert.equal(amountInWords(null, 'AED'), 'Zero UAE Dirham Only');
});
