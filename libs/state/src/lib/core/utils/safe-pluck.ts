import { isKeyOf } from './typing';
import { isObject } from 'util';

export function safePluck<T extends object, K1 extends keyof T>(
  stateObject: T,
  keys: K1 | [K1]
): T[K1];

export function safePluck<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T[K1]
>(stateObject: T, keys: [K1, K2]): T[K1][K2];

export function safePluck<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T[K1],
  K3 extends keyof T[K1][K2]
>(stateObject: T, keys: [K1, K2, K3]): T[K1][K2][K3];

export function safePluck<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T[K1],
  K3 extends keyof T[K1][K2],
  K4 extends keyof T[K1][K2][K3]
>(stateObject: T, keys: [K1, K2, K3, K4]): T[K1][K2][K3][K4];

export function safePluck<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T[K1],
  K3 extends keyof T[K1][K2],
  K4 extends keyof T[K1][K2][K3],
  K5 extends keyof T[K1][K2][K3][K4]
>(stateObject: T, keys: [K1, K2, K3, K4, K5]): T[K1][K2][K3][K4][K5];

export function safePluck<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T[K1],
  K3 extends keyof T[K1][K2],
  K4 extends keyof T[K1][K2][K3],
  K5 extends keyof T[K1][K2][K3][K4],
  K6 extends keyof T[K1][K2][K3][K4][K5]
>(
  stateObject: T,
  keys:
    | [K1]
    | [K1, K2]
    | [K1, K2, K3]
    | [K1, K2, K3, K4]
    | [K1, K2, K3, K4, K5]
    | [K1, K2, K3, K4, K5, K6]
): T[K1][K2][K3][K4][K5][K6];

export function safePluck<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T[K1],
  K3 extends keyof T[K1][K2],
  K4 extends keyof T[K1][K2][K3],
  K5 extends keyof T[K1][K2][K3][K4],
  K6 extends keyof T[K1][K2][K3][K4][K5]
>(
  stateObject: T,
  keys:
    | [K1]
    | [K1, K2]
    | [K1, K2, K3]
    | [K1, K2, K3, K4]
    | [K1, K2, K3, K4, K5]
    | [K1, K2, K3, K4, K5, K6]
):
  | T[K1]
  | T[K1][K2]
  | T[K1][K2][K3]
  | T[K1][K2][K3][K4]
  | T[K1][K2][K3][K4][K5]
  | T[K1][K2][K3][K4][K5][K6] | null | undefined {
  // needed to match null and undefined conventions of RxAngular core components
  if (stateObject == null) {
    return stateObject;
  }
  if (!keys || keys.length <= 0 || Object.keys(stateObject).length <= 0) {
    return undefined;
  }
  // clone keys in order to not mutate input
  const stateKeys = [...keys];
  let prop = stateObject[stateKeys.shift() as K1];
  stateKeys.forEach((key) => {
    if (isObject(prop) && isKeyOf(key)) {
      prop = prop[key];
    }
  });
  return prop;
}
