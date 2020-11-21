import { AfterViewInit, Component, ElementRef, Output, ViewChild } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { RxEffects } from '../../rx-effects.service';
import { Hooks } from '../../debug-helper/hooks';
import { RxState } from '@rx-angular/state';
import { fileReaderFromBlob, imageFromFileReader } from '../pixel-image';
import { ImgInfo } from '../model';
import { createImageConverter, ImgConverter } from '../image-converter';

interface ComponentState {
  loading: boolean;
  image: CanvasImageSource;
  pixelArray: number[][];
  width: number;
  height: number;
}


@Component({
  selector: 'rxa-image-array',
  template: `
    <div class="d-flex align-items-center">
      <mat-card>
        <mat-card-image>
          <img (click)="imgSelectionChange$.next($event.target)" src="assets/worrior.png" width="auto" height="auto">
        </mat-card-image>
      </mat-card>
      <mat-card>
        <mat-card-image>
          <img (click)="imgSelectionChange$.next($event.target)" src="assets/sonic.png" width="auto" height="auto">
        </mat-card-image>
      </mat-card>
      <mat-card>
        <mat-card-image>
          <img (click)="imgSelectionChange$.next($event.target)" src="assets/duck.png" width="auto" height="auto">
        </mat-card-image>
      </mat-card>
      <mat-card>
        <mat-card-image>
          <img (click)="imgSelectionChange$.next($event.target)" src="assets/pokemon.png" width="auto" height="auto">
        </mat-card-image>
      </mat-card>
      <mat-card>
        <mat-card-image>
          <img (click)="imgSelectionChange$.next($event.target)" src="assets/knight.png" width="auto" height="auto">
        </mat-card-image>
      </mat-card>
      <button type="button" mat-raised-button (click)="fileInput.click()">Choose File</button>
      <input hidden #fileInput (change)="filesChange$.next(fileInput.files[0])" type="file">
      <a href="http://pixelartmaker.com" target="_blank">Custom</a>
      <!-- <a href="http://pixelartmaker.com/gallery">Gallery</a> -->
      <mat-card style="background: #fff">
        <mat-card-image>
          <div #display class="display">
            <!-- canvas bootstrapped here-->
          </div>
        </mat-card-image>
      </mat-card>
    </div>
    <mat-progress-bar [mode]="'buffer'" *ngIf="imgConverter?.loading$ | push"></mat-progress-bar>
  `,
  styles: [`
    .pixel-canvas {
      border: 1px solid red;
    }
  `],
  providers: [RxEffects, RxState]
})
export class ImageArrayComponent extends Hooks implements AfterViewInit {

  filesChange$ = new Subject<any>();
  imgSelectionChange$ = new Subject<any>();
  canvas: HTMLCanvasElement;
  imgConverter: ImgConverter;

  @ViewChild('display')
  display;

  @Output()
  imageChange: Observable<ImgInfo> = this.afterViewInit$.pipe(
    switchMap(() => this.imgConverter.imgInfoChange$)
  );

  constructor(
    private elemRef: ElementRef,
    private rxEf: RxEffects,
    private state: RxState<ComponentState>
  ) {
    super();
    this.state.connect('image', this.filesChange$.pipe(fileReaderFromBlob(), imageFromFileReader()));
    this.state.connect('image', this.imgSelectionChange$);
    this.rxEf.hold(this.state.select(map(s => s.image)), (img: CanvasImageSource) => this.imgConverter.renderImage(img));

    this.rxEf.hold(this.afterViewInit$, () => {
      this.setupCanvas(this.display.nativeElement, 50, 50);
      this.setupConverter();
    });
  }

  setupCanvas(parent: HTMLElement, w: number, h: number) {
    this.canvas = document.createElement('canvas') as HTMLCanvasElement;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.className = 'pixel-canvas';
    parent.appendChild(this.canvas);
  }

  setupConverter(): void {
    this.imgConverter = createImageConverter(this.canvas);
  }

}
