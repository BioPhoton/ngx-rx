import { InjectionToken } from '@angular/core';
import { RxAngularConfig, RxDefaultStrategyNames } from './model';
import { RX_CONCURRENT_STRATEGIES } from './render-strategies/concurrent-strategies';
import { RX_DEFAULT_STRATEGIES } from './render-strategies/default-strategies';

export const RX_ANGULAR_CONFIG = new InjectionToken<RxAngularConfig<string>>(
  'rx-angular-config'
);

export const RX_ANGULAR_DEFAULTS: Required<
  RxAngularConfig<RxDefaultStrategyNames>
> = {
  primaryStrategy: 'normal',
  customStrategies: {
    ...RX_DEFAULT_STRATEGIES,
    ...RX_CONCURRENT_STRATEGIES,
  },
  patchZone: true,
};

export function mergeDefaultConfig<T extends string>(
  cfg?: RxAngularConfig<T>
): Required<RxAngularConfig<T | RxDefaultStrategyNames>> {
  const custom: RxAngularConfig<T> = cfg
    ? cfg
    : ({
        customStrategies: {},
      } as any);
  return {
    ...RX_ANGULAR_DEFAULTS,
    ...custom,
    customStrategies: {
      ...custom.customStrategies,
      ...RX_ANGULAR_DEFAULTS.customStrategies,
    },
  };
}
