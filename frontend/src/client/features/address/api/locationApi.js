import { apiRequest } from '../../../../utils/apiClient';

/**
 * Country/state/city pickers for the address form. Public + vendor-scoped
 * (allowedCountries comes from the cached CompanyMaster, no user needed), so
 * these go out unauthenticated. States/cities come back as nested
 * country->state->city groups already filtered to the vendor's allowed
 * countries - see utils/shapeLocations.js for flattening them.
 */

export const getCountries = () => apiRequest('/countries/get-countries', { auth: false });

export const getStates = () => apiRequest('/states/get-states', { auth: false });

export const getCities = () => apiRequest('/cities/get-cities', { auth: false });

export default { getCountries, getStates, getCities };
