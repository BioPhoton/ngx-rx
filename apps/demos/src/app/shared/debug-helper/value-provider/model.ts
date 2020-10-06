import { SchedulingPriority } from '@rx-angular/template';

export interface ProvidedValues {
  random: number;
  array: any[];
}

/**
 * id: newIndex
 */
export interface Positions {
  [id: number]: number
}

export interface SchedulerConfig {
  scheduler: SchedulingPriority;
  duration?: number;
  numEmissions?: number;
  tickSpeed?: number;
}
