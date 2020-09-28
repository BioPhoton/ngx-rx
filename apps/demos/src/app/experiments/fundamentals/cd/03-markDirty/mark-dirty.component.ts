import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CdConfigService } from '../../../../shared/debug-helper/strategy-control-panel';

@Component({
  selector: 'rxa-cd-parent03',
  template: `
    <h2>
      C 03
      <small
      >ɵmarkDirty when called in the component renders itself and all child
        components with cd.Default
      </small
      >
    </h2>
    <div class="case-info">
      <span>CD: <b class="cds">Default</b></span>
      <renders></renders>
    </div>
    <div class="case-interaction">
      <button mat-raised-button [unpatch] (click)="btnClick$.next($event)">ɵmarkDirty</button>
    </div>
    <div class="case-content">
      <rxa-cd03-child01-default></rxa-cd03-child01-default>
      <rxa-cd03-child02-push></rxa-cd03-child02-push>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default
})
export class MarkDirtyComponent {
  btnClick$ = new Subject<Event>();

  /*baseEffects$ = this.btnClick$.pipe(tap(() => this.cdConfig.markDirty()));
  constructor(public cdConfig: CdConfigService) {
  }*/
}
