/**
 * Flattens the nested country->state->city groups returned by
 * GET /states/get-states and /cities/get-cities (see
 * backend/services/stateMasterService.js / cityMasterService.js) down to the
 * options a single cascading dropdown needs for the currently selected
 * parent.
 */

export const getStatesForCountry = (stateGroups, countryId) => {
  if (!countryId) return [];
  const group = stateGroups.find((g) => String(g.countryId) === String(countryId));
  return group?.states || [];
};

export const getCitiesForState = (cityGroups, countryId, stateId) => {
  if (!countryId || !stateId) return [];
  const countryGroup = cityGroups.find((g) => String(g.countryId) === String(countryId));
  const stateGroup = countryGroup?.states.find((s) => String(s.stateId) === String(stateId));
  return stateGroup?.cities || [];
};
