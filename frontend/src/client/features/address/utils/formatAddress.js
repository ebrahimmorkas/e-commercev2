// Address docs come back with country_id/state_id/city_id populated to
// { _id, ...name } (see addressService.js's .populate calls).
export const formatAddress = (address) => {
  const idOf = (field) => (typeof field === 'object' && field !== null ? field : null);
  const country = idOf(address.country_id);
  const state = idOf(address.state_id);
  const city = idOf(address.city_id);
  const parts = [
    address.floor ? `Floor ${address.floor}` : null,
    address.building,
    address.address_in_words,
    [city?.city_name, state?.state_name].filter(Boolean).join(', '),
    country?.country_name,
    address.pincode,
  ].filter(Boolean);
  return parts.join(', ');
};

export default formatAddress;
