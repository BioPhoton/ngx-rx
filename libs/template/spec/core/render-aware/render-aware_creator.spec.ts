import { OnDestroy } from '@angular/core';
import { createRenderAware, RenderAware } from '../../../src/lib/core';
import { concat, EMPTY, NEVER, NextObserver, Observer, of, Unsubscribable } from 'rxjs';
import { DEFAULT_STRATEGY_NAME } from '../../../src/lib/render-strategies/strategies/strategies-map';

class CdAwareImplementation<U> implements OnDestroy {
  public renderedValue: any = undefined;
  public error: any = undefined;
  public completed = false;
  private readonly subscription: Unsubscribable;
  public cdAware: RenderAware<U | undefined | null>;
  resetObserver: NextObserver<any> = {
    next: _ => (this.renderedValue = undefined)
  };
  updateObserver: Observer<U | undefined | null> = {
    next: (n: U | undefined | null) => {
      this.renderedValue = n;
    },
    error: e => (this.error = e),
    complete: () => (this.completed = true)
  };

  constructor() {
    this.cdAware = createRenderAware<U>({
      strategies: {
        [DEFAULT_STRATEGY_NAME]: {
          name: DEFAULT_STRATEGY_NAME,
          renderMethod: () => {},
          scheduleCD: () => {},
          behavior: (o) => o
        }
      },
      updateObserver: this.updateObserver,
      resetObserver: this.resetObserver
    });
    this.subscription = this.cdAware.subscribe();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}

let cdAwareImplementation: CdAwareImplementation<any>;
const setupCdAwareImplementation = () => {
  cdAwareImplementation = new CdAwareImplementation();
  cdAwareImplementation.renderedValue = undefined;
  cdAwareImplementation.error = undefined;
  cdAwareImplementation.completed = false;
};

describe('CdAware', () => {
  beforeEach(() => {
    setupCdAwareImplementation();
  });

  it('should be implementable', () => {
    expect(cdAwareImplementation).toBeDefined();
  });

  describe('next value', () => {
    it('should do nothing if initialized (as no value ever was emitted)', () => {
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
    });

    it('should render undefined as value when initially undefined was passed (as no value ever was emitted)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(undefined);
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
    });

    it('should render null as value when initially null was passed (as no value ever was emitted)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(null);
      expect(cdAwareImplementation.renderedValue).toBe(null);
    });

    it('should render undefined as value when initially of(undefined) was passed (as undefined was emitted)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(of(undefined));
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
    });

    it('should render null as value when initially of(null) was passed (as null was emitted)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(of(null));
      expect(cdAwareImplementation.renderedValue).toBe(null);
    });

    it('should render undefined as value when initially EMPTY was passed (as no value ever was emitted)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(EMPTY);
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
    });

    it('should render undefined as value when initially NEVER was passed (as no value ever was emitted)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(NEVER);
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
    });
    // Also: 'should keep last emitted value in the view until a new observable NEVER was passed (as no value ever was emitted from new observable)'
    it('should render emitted value from passed observable without changing it', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(of(42));
      expect(cdAwareImplementation.renderedValue).toBe(42);
    });

    it('should render undefined as value when a new observable NEVER was passed (as no value ever was emitted from new observable)', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(of(42));
      expect(cdAwareImplementation.renderedValue).toBe(42);
      cdAwareImplementation.cdAware.nextPotentialObservable(NEVER);
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
    });
  });

  describe('observable context', () => {
    it('next handling running observable', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(
        concat(of(42), NEVER)
      );
      expect(cdAwareImplementation.renderedValue).toBe(42);
      expect(cdAwareImplementation.error).toBe(undefined);
      expect(cdAwareImplementation.completed).toBe(false);
    });

    it('next handling completed observable', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(of(42));
      expect(cdAwareImplementation.renderedValue).toBe(42);
      expect(cdAwareImplementation.error).toBe(undefined);
      expect(cdAwareImplementation.completed).toBe(true);
    });

    it('error handling', () => {
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
      cdAwareImplementation.cdAware.subscribe({
        error: (e: Error) => expect(e).toBeDefined()
      });
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
      // @TODO use this line
      // expect(cdAwareImplementation.error).toBe(ArgumentNotObservableError);
      expect(cdAwareImplementation.completed).toBe(false);
    });

    it('completion handling', () => {
      cdAwareImplementation.cdAware.nextPotentialObservable(EMPTY);
      expect(cdAwareImplementation.renderedValue).toBe(undefined);
      expect(cdAwareImplementation.error).toBe(undefined);
      expect(cdAwareImplementation.completed).toBe(true);
    });
  });
});
