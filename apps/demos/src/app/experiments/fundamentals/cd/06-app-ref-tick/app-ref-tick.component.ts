import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Subject } from 'rxjs';

import { tap } from 'rxjs/operators';
import { CdConfigService } from '../../../../shared/debug-helper/strategy-control-panel';

@Component({
  selector: 'app-cd-parent06',
  template: `
    <h2>
      CD 06
      <small
      >ApplicationRef#tick when called in the component renders itself and all
        child components with cd.Default</small
      >
    </h2>
    <div class="case-info">
      <span>CD: <b class="cds">Default</b></span>
      <renders></renders>
    </div>
    <div class="case-interaction">
      <button mat-raised-button [unpatch] (click)="btnClick$.next($event)">
        ApplicationRef#tick
      </button>
    </div>
    <div class="case-content">
      <app-cd06-child01-default></app-cd06-child01-default>
      <app-cd06-child02-push></app-cd06-child02-push>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default
})
export class AppRefTickComponent {
  btnClick$ = new Subject<Event>();

  constructor(private cdConfig: CdConfigService) {
  }
  baseEffects$ = this.btnClick$.pipe(tap(() => this.cdConfig.appRef_tick()));
}