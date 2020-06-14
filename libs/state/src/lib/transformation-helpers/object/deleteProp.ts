import { isObjectGuard, isKeyOf } from '../../core/utils/typing';

/**
 * @description
 * Accepts object of type T and key of type K extends keyof T.
 * Removes property from an object and returns new updated object without specified property.
 * If property not found returns copy of original object.
 * Not mutating original object.
 *
 * @example
 *
 * const cat = {id: 1, type: 'cat', name: 'Fluffy'};
 *
 * const anonymusCat = deleteProp(cat, 'name');
 *
 * // anonymusCat will be:
 * // {id: 1, type: 'cat'};
 *
 * @returns Omit<T, K>
 *
 * @docsPage deleteProp
 * @docsCategory transformation-helpers
 */
export function deleteProp<T extends object, K extends keyof T>(
  object: T,
  key: K
): Omit<T, K> {
  if (isObjectGuard(object) && isKeyOf<T>(key)) {
    const copy = { ...object };
    delete copy[key];
    return copy;
  }

  throw new Error(`wrong params to 'deleteProp'`);
}
