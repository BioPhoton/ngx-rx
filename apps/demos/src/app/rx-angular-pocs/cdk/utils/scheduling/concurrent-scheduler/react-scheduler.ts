import { Observable } from 'rxjs';
import { mapTo, switchMap } from 'rxjs/operators';
import { cancelCallback, scheduleCallback } from './react-source-code/scheduler';
import { coalescingManager } from '../../coalescing-manager';
import { ReactCallBackCredentials } from './model';
import { priorityLevel } from '../../../render-strategies/model/priority';

export const reactSchedulerTick = (credentials: ReactCallBackCredentials, context: any): Observable<number> =>
  new Observable<number>((subscriber) => {
    if (!coalescingManager.isCoalescing(context)) {
      const _work = () => {
        coalescingManager.decrement(context);
        if (!coalescingManager.isCoalescing(context)) {
          credentials[1]();
          subscriber.next(0);
        }
      };
      const task = scheduleCallback(credentials[0], _work, credentials[2]);
      coalescingManager.increment(context);
      return () => {
        coalescingManager.decrement(context);
        cancelCallback(task);
      };
    }
  });

// RenderBehavior
export function scheduleLikeReact<T>(priority: priorityLevel, work: any, context: any) {
  return (o$: Observable<T>): Observable<T> => o$.pipe(
    switchMap(v => reactSchedulerTick([priority, work], context).pipe(mapTo(v)))
  );
}

export function getConcurrentScheduler<T>(priority: priorityLevel) {
  const  work: any = undefined;
  const context: any = undefined;
  return (o$: Observable<T>): Observable<T> => o$.pipe(
    switchMap((v) => reactSchedulerTick([priority, work], context).pipe(mapTo(v)))
  );
}
