import {
  ChangeDetectorRef,
  Component,
  EmbeddedViewRef,
  IterableChanges,
  NgZone,
  TemplateRef,
  Type,
  ViewContainerRef,
  ɵdetectChanges as detectChanges,
} from '@angular/core';
import {
  asyncScheduler,
  combineLatest,
  isObservable,
  merge,
  Observable,
  ObservableInput,
  of,
  OperatorFunction,
  ReplaySubject,
  Subject,
} from 'rxjs';
import { MonoTypeOperatorFunction } from 'rxjs/internal/types';
import {
  delay,
  distinctUntilChanged,
  ignoreElements,
  map,
  mergeAll,
  share,
  startWith,
  switchAll,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';
import {
  StrategyCredentials,
  StrategyCredentialsMap,
} from '../render-strategies/model';
import {
  nameToStrategyCredentials,
  onStrategy,
} from '../render-strategies/utils';
import {
  CreateEmbeddedView,
  CreateListViewContext,
  CreateViewContext,
  RxListTemplateChange, RxListTemplateChanges,
  RxListViewComputedContext, RxListViewContext,
  RxViewContext, UpdateListViewContext,
  UpdateViewContext
} from './model';
import { RxNotification, RxNotificationKind } from '../model';

// Below are constants for LView indices to help us look up LView members
// without having to remember the specific indices.
// Uglify will inline these when minifying so there shouldn't be a cost.
const TVIEW = 1;
const T_HOST = 6;
const L_CONTAINER_NATIVE = 7;
const CONTEXT = 8;
const HEADER_OFFSET = 20;

export type TNode = any;

/**
 * @internal
 *
 * Returns the TNode of the passed node form TVIEW of passed cdRef
 *
 * @param cdRef
 * @param native
 */
export function getTNode(cdRef: ChangeDetectorRef, native: Node): TNode {
  const lView = (cdRef as any)._cdRefInjectingView;
  const tView = lView[TVIEW];
  let i = HEADER_OFFSET;
  let lContainer;
  while (!lContainer && i <= tView['bindingStartIndex']) {
    const candidate = lView[i];
    if (candidate && candidate[L_CONTAINER_NATIVE] === native) {
      lContainer = candidate;
    }
    i++;
  }
  return lContainer[T_HOST];
}

/**
 * @internal
 *
 * Returns a set of references to parent views
 *
 *
 * @param cdRef
 * @param tNode
 */
export function extractProjectionParentViewSet(
  cdRef: ChangeDetectorRef,
  tNode: TNode
): Set<Type<Component>> {
  const injectingLView = (cdRef as any)._cdRefInjectingView;
  const injectingTView = injectingLView[1];
  const components = new Set<number>(injectingTView['components']);
  const parentElements = new Set<Type<Component>>();
  let parent = tNode['parent'];
  while (parent != null && components.size > 0) {
    const idx = parent['index'];
    if (components.has(idx)) {
      // TODO: we should discuss about this. currently only the first Component will get returned, not a list of
      //  components. Maybe we should make the parent notification configurable regarding the level of `deepness`?
      // components.delete(idx);
      components.clear();
      parentElements.add(injectingLView[idx][CONTEXT]);
    }
    parent = parent['parent'];
  }
  return parentElements;
}

export function extractProjectionViews(
  cdRef: ChangeDetectorRef,
  tNode: TNode
): Type<any>[] {
  return Array.from(extractProjectionParentViewSet(cdRef, tNode));
}

/**
 * A side effect operator similar to `tap` but with a static logic
 *
 *
 *
 * @param cdRef
 * @param tNode
 * @param strategy$
 */
export function renderProjectionParents(
  cdRef: ChangeDetectorRef,
  tNode: TNode,
  strategy$: Observable<StrategyCredentials>
): OperatorFunction<any, any> {
  return (o$) =>
    o$.pipe(
      withLatestFrom(strategy$),
      switchMap(([_, strategy]) => {
        const parentElements = extractProjectionParentViewSet(cdRef, tNode);
        const behaviors = [];
        for (const el of parentElements.values()) {
          behaviors.push(
            onStrategy(
              el,
              strategy,
              (value, work, options) => {
                detectChanges(el);
              },
              { scope: el }
            )
          );
        }
        behaviors.push(
          onStrategy(
            null,
            strategy,
            (value, work, options) => work(cdRef, options.scope),
            { scope: (cdRef as any).context || cdRef }
          )
        );
        return merge(...behaviors);
      })
    );
}

export type RxViewContextMap<T> = Record<
  RxNotificationKind,
  (value?: any) => Partial<RxViewContext<T>>
>;

/**
 * @internal
 *
 * A factory function that returns a map of projections to turn a notification of a Observable (next, error, complete)
 *
 * @param customNextContext - projection function to provide custom properties as well as override existing
 */
export function notificationKindToViewContext<T>(
  customNextContext: (value: T) => object
): RxViewContextMap<T> {
  // @TODO rethink overrides
  return {
    suspense: (value?: any) => {
      return {
        $implicit: undefined,
        // if a custom value is provided take it, otherwise assign true
        $suspense: value !== undefined ? value : true,
        $error: false,
        $complete: false,
      };
    },
    next: (value: T | null | undefined) => {
      return {
        $implicit: value,
        $suspense: false,
        $error: false,
        $complete: false,
        ...customNextContext(value),
      };
    },
    error: (error: Error) => {
      return {
        $complete: false,
        $error: error,
        $suspense: false,
      };
    },
    complete: () => {
      return {
        $error: false,
        $complete: true,
        $suspense: false,
      };
    },
  };
}

/**
 * @internal
 *
 * A factory for the createEmbeddedView function used in `TemplateManager` and `ListManager`.
 * It handles the creation of views in and outside of zone depending on the setting.
 *
 * Both ways of creating EmbeddedViews have pros and cons,
 * - create it outside out zone disables all event listener patching of the view, is fast, but you may need patched event listeners in some cases.
 * - create it inside of zone created many change detections as the creation may get chunked up and rendered over multiple ticks by a strategy used in `TemplateManager` or `ListManager`.
 *
 * @param viewContainerRef
 * @param patchZone
 */
export function getEmbeddedViewCreator(
  viewContainerRef: ViewContainerRef,
  patchZone: NgZone | false
): <C, T>(
  templateRef: TemplateRef<C>,
  context?: C,
  index?: number
) => EmbeddedViewRef<C> {
  let create = <C, T>(templateRef: TemplateRef<C>, context: C, index: number) =>
    viewContainerRef.createEmbeddedView(templateRef, context, index);
  if (patchZone) {
    create = <C, T>(templateRef: TemplateRef<C>, context: C, index: number) =>
      patchZone.run(() =>
        viewContainerRef.createEmbeddedView(templateRef, context, index)
      );
  }
  return create;
}

/**
 * @internal
 *
 * A side effect operator similar to `tap` but with a static internal logic.
 * It calls detect changes on the 'VirtualParent' and the injectingViewCdRef.
 *
 * @param tNode
 * @param injectingViewCdRef
 * @param strategy
 * @param notifyNeeded
 */
export function notifyAllParentsIfNeeded<T>(
  tNode: TNode,
  injectingViewCdRef: ChangeDetectorRef,
  strategy: StrategyCredentials,
  notifyNeeded: () => boolean
): MonoTypeOperatorFunction<T> {
  return (o$) =>
    o$.pipe(
      delay(0, asyncScheduler),
      switchMap((v) => {
        const notifyParent = notifyNeeded();
        if (!notifyParent) {
          return of(v);
        }
        const behaviors = getVirtualParentNotifications$(
          tNode,
          injectingViewCdRef,
          strategy
        );
        // @TODO remove this CD on injectingViewCdRef if possible
        behaviors.push(
          onStrategy(
            null,
            strategy,
            (_v, work, options) => work(injectingViewCdRef, options.scope),
            { scope: (injectingViewCdRef as any).context || injectingViewCdRef }
          )
        );
        if (behaviors.length === 1) {
          return of(v);
        }
        return combineLatest(behaviors).pipe(ignoreElements(), startWith(v));
      })
    );
}

/**
 * @internal
 *
 * returns an Observable executing a side effects for change detection of parents
 *
 * @param injectingViewCdRef
 * @param strategy
 * @param notify
 */
export function notifyInjectingParentIfNeeded(
  injectingViewCdRef: ChangeDetectorRef,
  strategy: StrategyCredentials,
  notify: boolean
): Observable<null> {
  return startWith<null>(null)(
    notify
      ? onStrategy(
          null,
          strategy,
          (value, work, options) => {
            // console.log('notify injectingView', injectingViewCdRef);
            work(injectingViewCdRef, options.scope);
          }
          //  scopeOnInjectingViewContext
        ).pipe(ignoreElements())
      : (([] as unknown) as Observable<never>)
  );
}

/**
 * @internal
 *
 * Returns an array of observables triggering `detectChanges` on the __virtual parent__  (parent of the projected view)
 *
 * @param tNode - is a component that was projected into another component (virtual parent)
 * @param injectingViewCdRef - is needed to get the
 * @param strategy - the strategy to run the change detection
 */
export function getVirtualParentNotifications$(
  tNode: TNode,
  injectingViewCdRef: ChangeDetectorRef,
  strategy: StrategyCredentials
): Observable<Comment>[] {
  const parentElements = extractProjectionParentViewSet(
    injectingViewCdRef,
    tNode
  );
  const behaviors = [];
  for (const parentComponent of parentElements.values()) {
    behaviors.push(
      onStrategy(
        parentComponent,
        strategy,
        // Here we CD the parent to update their projected views scenarios
        (value, work, options) => {
          // console.log('parentComponent', parentComponent);
          detectChanges(parentComponent);
        },
        { scope: parentComponent }
      )
    );
  }
  return behaviors;
}

/**
 * @internal
 *
 * A factory function returning an object to handle `TemplateRef`'s.
 * You can add and get a `TemplateRef`.
 *
 */
export function templateHandling<N, C>(): {
  add(name: N, templateRef: TemplateRef<C>): void;
  get(name: N): TemplateRef<C>;
} {
  const templateCache = new Map<N, TemplateRef<C>>();

  return {
    add(name: N, templateRef: TemplateRef<C>): void {
      assertTemplate(name, templateRef);
      if (!templateCache.has(name)) {
        templateCache.set(name, templateRef);
      } else {
        throw new Error(
          'Updating an already existing Template is not supported at the moment.'
        );
      }
    },
    get(name: N): TemplateRef<C> {
      return templateCache.get(name);
    },
  };

  //
  function assertTemplate<T>(
    property: any,
    templateRef: TemplateRef<T> | null
  ): templateRef is TemplateRef<T> {
    const isTemplateRefOrNull = !!(
      !templateRef || templateRef.createEmbeddedView
    );
    if (!isTemplateRefOrNull) {
      throw new Error(
        `${property} must be a TemplateRef, but received something else.`
      );
    }
    return isTemplateRefOrNull;
  }
}


/**
 * @internal
 *
 * A factory function returning an object to handle the process of switching templates by Notification channel.
 * You can next a Observable of `RxNotification` multiple times and merge them into the Observable exposed under `trigger$`
 *
 */
export function templateTriggerHandling<T>(): {
  trigger$: Observable<RxNotification<T>>;
  next(templateName: Observable<RxNotification<T>>): void;
} {
  const templateTriggerSubject = new Subject<Observable<RxNotification<T>>>();
  const trigger$ = templateTriggerSubject.pipe(mergeAll());
  return {
    next(templateName: Observable<RxNotification<T>>) {
      templateTriggerSubject.next(templateName);
    },
    trigger$,
  };
}

/**
 * @internal
 *
 * A factory function returning an object to handle the process of merging Observable next notifications into one Observable.
 * This API takes away the clumsy handling of static values and Observable, reduces the number of emissions by:
 * - only merging distinct Observables
 * - only emit distingt values of the merged result
 *
 * You can next a Observable of `U` multiple times and merge them into the Observable exposed under one optimized `values$`
 *
 */
export function getHotMerged<U>(): {
  values$: Observable<U>;
  next(observable: ObservableInput<U> | U): void;
} {
  const observablesSubject = new ReplaySubject<ObservableInput<U> | U>(1);
  const values$ = observablesSubject.pipe(
    coerceDistinctWith()
  ) as Observable<U>;

  return {
    next(observable: ObservableInput<U> | U) {
      observablesSubject.next(observable);
    },
    values$,
  };
}

/**
 * @internal
 *
 * An object that holds methods needed to introduce actions to a list e.g. move, remove, insert
 */
export interface ListTemplateManager<T> {
  updateUnchangedContext(index: number, count: number): void;

  insertView(item: T, index: number, count: number): void;

  moveView(oldIndex: number, item: T, index: number, count: number): void;

  updateView(item: T, index: number, count: number): void;

  removeView(index: number): void;
}

/**
 * @internal
 *
 * Factory that returns a `ListTemplateManager` for the passed params.
 *
 * @param templateSettings
 */
export function getListTemplateManager<
  C extends RxListViewContext<T>,
  T
>(templateSettings: {
  viewContainerRef: ViewContainerRef;
  patchZone: NgZone | false;
  templateRef: TemplateRef<C>;
  createViewFactory?: CreateEmbeddedView<C>,
  createViewContext: CreateListViewContext<T, C, RxListViewComputedContext>;
  updateViewContext: UpdateListViewContext<T, C, RxListViewComputedContext>;
}): ListTemplateManager<T> {
  const {
    viewContainerRef,
    templateRef,
    createViewContext,
    updateViewContext,
    patchZone,
    createViewFactory
  } = templateSettings;
  const createEmbeddedView = createViewFactory ? createViewFactory(viewContainerRef, patchZone) : getEmbeddedViewCreator(
    viewContainerRef,
    patchZone
  );

  return {
    updateUnchangedContext,
    insertView,
    moveView,
    updateView,
    removeView,
  };

  // =====

  function updateUnchangedContext(index: number, count: number) {
    const view = <EmbeddedViewRef<C>>viewContainerRef.get(index);
    view.context.updateContext({
      count,
      index
    });
    view.detectChanges();
  }

  function moveView(
    oldIndex: number,
    item: T,
    index: number,
    count: number
  ): void {
    const oldView = viewContainerRef.get(oldIndex);
    const view = <EmbeddedViewRef<C>>viewContainerRef.move(oldView, index);
    updateViewContext(
      item,
      view,
      {
        count,
        index,
      }
    );
    view.detectChanges();
  }

  function updateView(item: T, index: number, count: number): void {
    const view = <EmbeddedViewRef<C>>viewContainerRef.get(index);
    updateViewContext(item, view, {
      count,
      index,
    });
    view.detectChanges();
  }

  function removeView(index: number): void {
    viewContainerRef.remove(index);
  }

  function insertView(item: T, index: number, count: number): void {
    const newView = createEmbeddedView(
      templateRef,
      createViewContext(item, {
        count,
        index,
      }),
      index
    );
    newView.detectChanges();
  }
}

/**
 * @internal
 *
 * @param changes
 * @param items
 */
export function getListChanges<T>(
  changes: IterableChanges<T>,
  items: T[]
): RxListTemplateChanges {
  const changedIdxs = new Set<T>();
  const changesArr = [];
  let notifyParent = false;
  changes.forEachOperation((record, adjustedPreviousIndex, currentIndex) => {
    const item = record.item;
    if (record.previousIndex == null) {
      // insert
      changesArr.push(getInsertChange(item, currentIndex));
      changedIdxs.add(item);
      notifyParent = true;
    } else if (currentIndex == null) {
      // remove
      changesArr.push(getRemoveChange(item, adjustedPreviousIndex));
      changedIdxs.add(item);
      notifyParent = true;
    } else if (adjustedPreviousIndex !== null) {
      // move
      changesArr.push(
        getMoveChange(item, currentIndex, adjustedPreviousIndex)
      );
      changedIdxs.add(item);
      notifyParent = true;
    }
  });
  changes.forEachIdentityChange((record) => {
    const item = record.item;
    changesArr.push(getUpdateChange(item, record.currentIndex));
    changedIdxs.add(item);
  });
  items.forEach((item, index) => {
    if (!changedIdxs.has(item)) {
      changesArr.push(getUnchangedChange(item, index));
    }
  });
  return [changesArr, notifyParent];

  // ==========

  function getMoveChange(
    item: T,
    currentIndex: number,
    adjustedPreviousIndex: number
  ): [RxListTemplateChange, any] {
    return [RxListTemplateChange.move, [item, currentIndex, adjustedPreviousIndex]];
  }

  function getUpdateChange(item: T, currentIndex: number): [RxListTemplateChange, any] {
    return [RxListTemplateChange.update, [item, currentIndex]];
  }

  function getUnchangedChange(item: T, index: number): [RxListTemplateChange, any] {
    return [RxListTemplateChange.context, [item, index]];
  }

  function getInsertChange(item: T, currentIndex: number): [RxListTemplateChange, any] {
    return [
      RxListTemplateChange.insert,
      [item, currentIndex === null ? undefined : currentIndex],
    ];
  }

  function getRemoveChange(
    item: T,
    adjustedPreviousIndex: number
  ): [RxListTemplateChange, any] {
    return [
      RxListTemplateChange.remove,
      adjustedPreviousIndex === null ? undefined : adjustedPreviousIndex,
    ];
  }
}

/**
 * This Observable factory creates an Observable out of a static value or ObservableInput.
 *
 * @param o - the value to coerce
 */
export function coerceObservable<T>(
  o: ObservableInput<T | null | undefined> | T | null | undefined
): Observable<T | null | undefined> {
  return isObservable<T>(o) ? o : of(o as T | null | undefined);
}

/**
 * This operator maps an Observable out of a static value or ObservableInput.
 *
 */
export function coerceObservableWith<T>(): OperatorFunction<
  Observable<T | null | undefined> | T | null | undefined,
  Observable<T | null | undefined>
> {
  return (o$: Observable<Observable<T> | T>) => map(coerceObservable)(o$);
}

/**
 * This Observable factory creates an Observable out of a static value or ObservableInput.
 * It forwards only distinct values from distinct incoming Observables or values.
 * This comes in handy in any environment where you handle processing of incoming dynamic values and their state.
 *
 * Optionally you can pass a flatten strategy to get find grained control of the flattening process. E.g. mergeAll, switchAll
 *
 * @param o$ - The Observable to coerce and map to a Observable with distinct values
 * @param flattenOperator - determines the flattening strategy e.g. mergeAll, concatAll, exhaust, switchAll. default is switchAll
 */
export function coerceDistinct<T>(
  o$: Observable<Observable<T> | T>,
  flattenOperator?: OperatorFunction<ObservableInput<T>, T>
) {
  flattenOperator = flattenOperator || switchAll();
  return coerceObservable(o$).pipe(
    distinctUntilChanged(),
    flattenOperator,
    distinctUntilChanged()
  );
}

/**
 * This operator takes an Observable of values ot Observables aof values and
 * It forwards only distinct values from distinct incoming Observables or values.
 * This comes in handy in any environment where you handle processing of incoming dynamic values and their state.
 *
 * Optionally you can pass a flatten strategy to get find grained control of the flattening process. E.g. mergeAll, switchAll
 *
 * @param flattenOperator - determines the flattening strategy e.g. mergeAll, concatAll, exhaust, switchAll. default is switchAll
 *
 */
export function coerceDistinctWith<T>(
  flattenOperator?: OperatorFunction<ObservableInput<T>, T>
) {
  flattenOperator = flattenOperator || switchAll();
  return (o$: Observable<Observable<T> | T>) =>
    o$.pipe(
      coerceObservableWith(),
      distinctUntilChanged(),
      flattenOperator,
      distinctUntilChanged()
    );
}