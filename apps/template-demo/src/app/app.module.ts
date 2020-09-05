import { LayoutModule } from '@angular/cdk/layout';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';

import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app-component/app.component';
import { ROUTES } from './app.routes';
import { ViewportPrioModule } from '@rx-angular/template';
import { ComparisonUnpatchModule } from './examples/unpatch/comparison-unpatch.module';
import { SharedModule } from './shared/shared.module';
import { RxLetDemoModule } from './examples/rx-let/rx-let-demo.module';

export const materialModules = [
  BrowserAnimationsModule,
  LayoutModule,
  MatToolbarModule,
  MatButtonModule,
  MatSidenavModule,
  MatIconModule,
  MatListModule,
  MatMenuModule
];

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    RouterModule.forRoot(ROUTES),
    materialModules,
    ViewportPrioModule,
    SharedModule
  ],
  declarations: [AppComponent],
  exports: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
