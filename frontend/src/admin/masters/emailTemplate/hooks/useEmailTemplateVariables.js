import { useEffect, useState } from 'react';
import * as emailTemplateApi from '../api/emailTemplateApi';
import { EMAIL_MODULE_OPTIONS } from '../constants';

/**
 * Loads the merge-token list ({{key}} + description) for every module once,
 * so the form can offer the right insertable variables as soon as a module is
 * picked. A module whose lookup fails just has no variables - the editor still
 * works without them.
 *
 * @returns {{ variablesByModule: Record<string, {key: string, description: string}[]> }}
 */
export const useEmailTemplateVariables = () => {
  const [variablesByModule, setVariablesByModule] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      EMAIL_MODULE_OPTIONS.map(async ({ value }) => {
        try {
          const variables = await emailTemplateApi.getAvailableVariables(value);
          return [value, Array.isArray(variables) ? variables : []];
        } catch {
          return [value, []];
        }
      })
    ).then((entries) => {
      if (!cancelled) setVariablesByModule(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { variablesByModule };
};

export default useEmailTemplateVariables;
