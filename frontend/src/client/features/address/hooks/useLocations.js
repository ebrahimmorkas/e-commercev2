import { useEffect, useState } from 'react';
import { getCountries, getStates, getCities } from '../api/locationApi';

/**
 * Loads the vendor's allowed countries + nested state/city groups once, for
 * the address form's cascading dropdowns.
 */
export const useLocations = () => {
  const [countries, setCountries] = useState([]);
  const [stateGroups, setStateGroups] = useState([]);
  const [cityGroups, setCityGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [countriesResult, statesResult, citiesResult] = await Promise.all([
          getCountries(),
          getStates(),
          getCities(),
        ]);
        if (cancelled) return;
        setCountries(countriesResult || []);
        setStateGroups(statesResult || []);
        setCityGroups(citiesResult || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load countries/states/cities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { countries, stateGroups, cityGroups, loading, error };
};

export default useLocations;
