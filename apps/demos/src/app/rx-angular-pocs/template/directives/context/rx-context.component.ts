import {
  ChangeDetectorRef,
  Component,
  Directive,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';

import { isObservable, Observable, of, ReplaySubject, Subscription, Unsubscribable } from 'rxjs';
import {
  createTemplateManager,
  Hooks,
  nameToStrategyCredentials,
  ngInputFlatten,
  rxMaterialize,
  RxNotificationKind,
  StrategyCredentials,
  StrategyProvider,
  TemplateManager
} from '../../../cdk';
import { RxContextTemplateNames, rxContextTemplateNames, RxContextViewContext } from './model';
import { distinctUntilChanged, filter, map, mapTo, startWith, switchMap, withLatestFrom } from 'rxjs/operators';
import { RxState } from '@rx-angular/state';

@Component({
  // tslint:disable-next-line:directive-selector component-selector
  selector: 'rxContextContainer',
  template: `
  <ng-content></ng-content>
  <ng-content select="rxSuspenseTpl"></ng-content>
  <ng-content select="rxErrorTpl"></ng-content>
  <ng-content select="rxCompleteTpl"></ng-content>
  `,
  providers: [RxState]
})
// tslint:disable-next-line:directive-class-suffix
export class RxContextContainer<U> extends Hooks implements OnInit, OnDestroy {

  @Input()
  set rxContextContainer(potentialObservable: Observable<U> | null | undefined) {
    this.rxState.connect('templateName', potentialObservable.pipe(toTemplateName()));
  }

  @Input('rxContextStrategy')
  set strategy(strategyName$: string | Observable<string> | undefined) {
    this.rxState.connect('strategyName', isObservable(strategyName$) ? strategyName$ : of(strategyName$));
  }

  @Input('rxContextCompleteTrg')
  set rxCompleteTrigger(complete$: Observable<any>) {
    this.rxState.connect('templateName', complete$.pipe(mapTo(RxNotificationKind.complete)));
  }

  @Input('rxContextErrorTrg')
  set rxErrorTrigger(error$: Observable<any>) {
    this.rxState.connect('templateName', error$.pipe(mapTo(RxNotificationKind.error)));
  }

  @Input('rxContextSuspenseTrg')
  set rxSuspenseTrigger(suspense$: Observable<any>) {
    this.rxState.connect('templateName', suspense$.pipe(mapTo(RxNotificationKind.suspense)));
  }

  constructor(
    private strategyProvider: StrategyProvider,
    public cdRef: ChangeDetectorRef,
    private readonly nextTemplateRef: TemplateRef<RxContextViewContext<U>>,
    private readonly viewContainerRef: ViewContainerRef,
    private readonly rxState: RxState<{
      templateName: RxNotificationKind,
      strategyName: string
    }>
  ) {
    super();
    this.templateManager = createTemplateManager(
      this.viewContainerRef,
      this.initialViewContext
    );

  }

  static ngTemplateGuard_rxContext: 'binding';

  strategy$: Observable<StrategyCredentials> = this.rxState.select(
    ngInputFlatten(),
    startWith(this.strategyProvider.primaryStrategy),
    nameToStrategyCredentials(this.strategyProvider.strategies, this.strategyProvider.primaryStrategy)
  );

  observablesFromTemplate$ = new ReplaySubject<Observable<U>>(1);
  valuesFromTemplate$ = this.observablesFromTemplate$.pipe(
    distinctUntilChanged()
  );

  private subscription: Unsubscribable = Subscription.EMPTY;

  private readonly templateManager: TemplateManager<RxContextViewContext<U | undefined | null>, rxContextTemplateNames>;

  private readonly initialViewContext: RxContextViewContext<U> = {
    $implicit: undefined,
    $error: false,
    $complete: false,
    $suspense: false
  };

  /** @internal */
  static ngTemplateContextGuard<U>(
    dir: RxContextContainer<U>,
    ctx: unknown | null | undefined
  ): ctx is RxContextViewContext<U> {
    return true;
  }

  ngOnInit() {
    this.templateManager.addTemplateRef(RxContextTemplateNames.content, this.nextTemplateRef);
    this.templateManager.displayView(RxContextTemplateNames.content);

    if(!this.rxState.get('templateName')) {
      this.rxState.set({ templateName: RxNotificationKind.suspense });
    }

    this.rxState.hold(this.rxState.select(
      map(s => s.templateName),
      distinctUntilChanged(),
      withLatestFrom(this.strategy$),
      switchMap(([templateName, strategy]) => {
        return of(templateName).pipe(
          strategy.behavior(() => {
            const name = this.templateManager.getTemplateName(templateName as any, RxContextTemplateNames.content);
            // this.templateManager.displayContextView(name);
            strategy.work(this.templateManager.getEmbeddedView(name), this.templateManager.getEmbeddedView(name));
            strategy.work(this.cdRef, (this.cdRef as any)?.context || this.cdRef);
          }, this)
        );
      })
      )
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.templateManager.destroy();
  }

}

function toTemplateName<T>() {
  return (o$: Observable<T>): Observable<RxNotificationKind> => o$.pipe(
    rxMaterialize(),
    filter(notification => notification.kind === RxNotificationKind.next),
    map(n => n.kind)
  );
}
