import { StrategyCredentials, StrategyCredentialsMap } from './model';
import { ɵmarkDirty as markDirty } from '@angular/core';
import { coalesceWith, priorityTickMap, SchedulingPriority } from '@rx-angular/template';
import { tap } from 'rxjs/operators';

export function getDefaultStrategyNames(): string[] {
  return Object.keys(getDefaultStrategyCredentialsMap());
}

export function getDefaultStrategyCredentialsMap(): StrategyCredentialsMap {
  return {
    'global': globalCredentials,
    'native': nativeCredentials,
    'noop': noopCredentials,
    'local': localCredentials
  };
}

const localCredentials: StrategyCredentials = {
  name: 'local',
  work: (cdRef) => cdRef.detectChanges(),
  behavior: (work: any, scope) => {
    return o$ => o$.pipe(
      coalesceWith(priorityTickMap[SchedulingPriority.animationFrame], scope),
      tap(() => work())
    );
  }
};

const globalCredentials: StrategyCredentials = {
  name: 'global',
  work: (cdRef) => markDirty((cdRef as any).context),
  behavior: (work: any) => o$ => o$.pipe(tap(() => work()))
};

const noopCredentials: StrategyCredentials = {
  name: 'noop',
  work: () => void 0,
  behavior: () => o$ => o$
};

const nativeCredentials: StrategyCredentials = {
  name: 'native',
  work: (cdRef) => cdRef.markForCheck(),
  behavior: (work: any) => o$ => o$.pipe(tap(() => work()))
};

