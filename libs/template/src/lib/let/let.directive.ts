import {
  ChangeDetectorRef,
  Directive,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

import {
  NextObserver,
  Observable,
  ObservableInput,
  Observer,
  Unsubscribable,
  Subscription,
} from 'rxjs';
import { createRenderAware, RenderAware, StrategySelection } from '../core';
import {
  createTemplateManager,
  TemplateManager,
} from '../core/utils/template-manager_creator';
import {
  DEFAULT_STRATEGY_NAME,
  getStrategies,
} from '../render-strategies/strategies/strategies-map';
import { RxTemplateObserver, RxViewContext } from '../core/model';

export interface LetViewContext<T> extends RxViewContext<T> {
  // to enable `as` syntax we have to assign the directives selector (var as v)
  rxLet: T;
}

/**
 * @Directive LetDirective
 *
 * @description
 *
 * The `*rxLet` directive serves a convenient way of binding observables to a view context (a dom element scope).
 * It also helps with several internal processing under the hood.
 *
 * The current way of binding an observable to the view looks like that:
 * ```html
 * <ng-container *ngIf="observableNumber$ as n">
 *   <app-number [number]="n"></app-number>
 *   <app-number-special [number]="n"></app-number-special>
 * </ng-container>
 *  ```
 *
 * The problem is `*ngIf` is also interfering with rendering and in case of a `0` the component would be hidden.
 *
 * Included Features for `*rxLet`:
 * - binding is always present. (`*ngIf="truthy$"`)
 * - it takes away the multiple usages of the `async` or `push` pipe
 * - a unified/structured way of handling null and undefined
 * - triggers change-detection differently if `zone.js` is present or not (`ChangeDetectorRef.detectChanges` or
 *   `ChangeDetectorRef.markForCheck`)
 * - triggers change-detection differently if ViewEngine or Ivy is present (`ChangeDetectorRef.detectChanges` or
 *   `ɵdetectChanges`)
 * - distinct same values in a row (distinctUntilChanged operator),
 *
 * @usageNotes
 *
 * The `*rxLet` directive takes over several things and makes it more convenient and save to work with streams in the
 * template:
 *
 * ```html
 * <ng-container *rxLet="observableNumber$ as n">
 *   <app-number [number]="n"></app-number>
 * </ng-container>
 *
 * <ng-container *rxLet="observableNumber$; let n">
 *   <app-number [number]="n"></app-number>
 * </ng-container>
 * ```
 *
 * In addition to that it provides us information from the whole observable context.
 * We can track the observables:
 * - next value
 * - error occurrence
 * - complete occurrence
 *
 * ```html
 * <ng-container *rxLet="observableNumber$; let n; let e = $error, let c = $complete">
 *   <app-number [number]="n" *ngIf="!e && !c"></app-number>
 *   <ng-container *ngIf="e">
 *     There is an error: {{ e }}
 *   </ng-container>
 *   <ng-container *ngIf="c">
 *     Observable completed: {{ c }}
 *   </ng-container>
 * </ng-container>
 * ```
 *
 * You can also use template anchors and display template's content for different observable states:
 * - on complete
 * - on error
 * - on suspense - before the first value is emitted
 *
 * ```html
 * <ng-container
 *   *rxLet="
 *     observableNumber$;
 *     let n;
 *     error: error;
 *     complete: complete;
 *     suspense: suspense;
 *   "
 * >
 *   <app-number [number]="n"></app-number>
 * </ng-container>
 * <ng-template #error>ERROR</ng-template>
 * <ng-template #complete>COMPLETE</ng-template>
 * <ng-template #suspense>SUSPENSE</ng-template>
 * ```
 *
 * @publicApi
 */
@Directive({
  selector: '[rxLet]',
  exportAs: 'renderNotifier',
})
export class LetDirective<U> implements OnInit, OnDestroy {
  static ngTemplateGuard_rxLet: 'binding';

  readonly strategies: StrategySelection;
  readonly renderAware: RenderAware<U | null | undefined>;

  @Input()
  set rxLet(potentialObservable: ObservableInput<U> | null | undefined) {
    this.renderAware.nextPotentialObservable(potentialObservable);
  }
  @Input('rxLetStrategy')
  set strategy(strategy: string | Observable<string> | undefined) {
    this.renderAware.nextStrategy(strategy || DEFAULT_STRATEGY_NAME);
  }
  @Input()
  set rxLetComplete(
    templateRef: TemplateRef<LetViewContext<U | undefined | null> | null>
  ) {
    this.templateManager.addTemplateRef('rxComplete', templateRef);
  }
  @Input()
  set rxLetError(
    templateRef: TemplateRef<LetViewContext<U | undefined | null> | null>
  ) {
    this.templateManager.addTemplateRef('rxError', templateRef);
  }
  @Input()
  set rxLetSuspense(
    templateRef: TemplateRef<LetViewContext<U | undefined | null> | null>
  ) {
    this.templateManager.addTemplateRef('rxSuspense', templateRef);
  }

  protected subscription: Unsubscribable = new Subscription();

  private readonly templateManager: TemplateManager<
    LetViewContext<U | undefined | null>
  >;
  private readonly templateObserver: RxTemplateObserver<
    U | null | undefined
  > = {
    suspense: () => {
      this.templateManager.updateViewContext({
        $implicit: undefined,
        rxLet: undefined,
        $suspense: true,
        $error: false,
        $complete: false,
      });
    },
    next: (value: U | null | undefined) => {
      this.templateManager.insertEmbeddedView('rxNext');
      this.templateManager.updateViewContext({
        $implicit: value,
        rxLet: value,
        $suspense: false,
        $error: false,
        $complete: false,
      });
    },
    error: (error: Error) => {
      // fallback to rxNext when there's no template for rxError
      this.templateManager.insertEmbeddedView('rxNext');
      this.templateManager.insertEmbeddedView('rxError');
      this.templateManager.updateViewContext({
        $implicit: undefined,
        rxLet: undefined,
        $suspense: false,
        $error: true,
        $complete: false,
      });
    },
    complete: () => {
      // fallback to rxNext when there's no template for rxComplete
      this.templateManager.insertEmbeddedView('rxNext');
      this.templateManager.insertEmbeddedView('rxComplete');
      this.templateManager.updateViewContext({
        $implicit: undefined,
        rxLet: undefined,
        $suspense: false,
        $error: false,
        $complete: true,
      });
    },
  };

  static ngTemplateContextGuard<U>(
    dir: LetDirective<U>,
    ctx: unknown | null | undefined
  ): ctx is LetViewContext<U> {
    return true;
  }

  constructor(
    cdRef: ChangeDetectorRef,
    private readonly nextTemplateRef: TemplateRef<LetViewContext<U>>,
    private readonly viewContainerRef: ViewContainerRef
  ) {
    this.strategies = getStrategies({ cdRef });
    this.templateManager = createTemplateManager(this.viewContainerRef, {
      $suspense: undefined,
      $implicit: undefined,
      rxLet: undefined,
      $error: false,
      $complete: false,
    });

    this.renderAware = createRenderAware({
      strategies: this.strategies,
      templateObserver: this.templateObserver,
    });
    this.renderAware.nextStrategy(DEFAULT_STRATEGY_NAME);
  }

  ngOnInit() {
    this.templateManager.insertEmbeddedView('rxSuspense');
    this.templateManager.addTemplateRef('rxNext', this.nextTemplateRef);
    this.subscription = this.renderAware.subscribe();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.templateManager.destroy();
  }
}
