import { RenderStrategy, RenderStrategyFactoryConfig } from '../../core';
import { tap } from 'rxjs/operators';

/**
 * Native Strategy
 * @description
 *
 * - mFC - `cdRef.markForCheck`
 *
 * This strategy mirrors Angular's built-in `async` pipe.
 * This means for every emitted value `ChangeDetectorRef#markForCheck` is called.
 *
 * | Name        | ZoneLess | Render Method | ScopedCoalescing | Scheduling | Chunked |
 * |-------------| ---------| --------------| ---------------- | ---------- |-------- |
 * | `native`    | ❌       | mFC           | ❌                | ❌         | ❌      |
 *
 * @param config { RenderStrategyFactoryConfig } - The values this strategy needs to get calculated.
 * @return {RenderStrategy} - The calculated strategy
 *
 */
export function createNativeStrategy(
  config: RenderStrategyFactoryConfig
): RenderStrategy {
  const component = (config.cdRef as any).context;
  return {
    name: 'native',
    detectChanges: () => config.cdRef.markForCheck(),
    rxScheduleCD: (o) => o.pipe(tap(() => {
      config.cdRef.markForCheck()
    })),
    scheduleCD: () => {
      config.cdRef.markForCheck()
      return new AbortController();
    },
  };
}
