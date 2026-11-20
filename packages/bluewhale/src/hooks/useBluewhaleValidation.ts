import { useCallback } from 'react';
import { validate } from '@redishfish/bluewhale-core';

const DEFAULT_ERROR_MESSAGE = 'Enter a valid Stellar G or M destination address.';

/**
 * Returns a validator that can be passed directly to React Hook Form's
 * `register` options. Empty values pass so `required` can be configured
 * separately; contract addresses are valid StrKeys but not payment targets.
 */
export function useBluewhaleValidation(
  errorMessage = DEFAULT_ERROR_MESSAGE,
): (address: string) => true | string {
  return useCallback(
    (address: string) => {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) return true;

      return validate(trimmedAddress) && !trimmedAddress.startsWith('C')
        ? true
        : errorMessage;
    },
    [errorMessage],
  );
}
