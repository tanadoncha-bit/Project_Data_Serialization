function testPaymentsEnabled() {
  return (process.env.OMISE_MODE || 'test') === 'test' && process.env.OMISE_TEST_PAYMENTS === 'true';
}
function accessFilter() {
  if (process.env.NODE_ENV !== 'production') return {};
  return { paymentMode: { $nin: testPaymentsEnabled() ? ['demo'] : ['demo', 'gateway-test'] } };
}
module.exports = { testPaymentsEnabled, accessFilter };
