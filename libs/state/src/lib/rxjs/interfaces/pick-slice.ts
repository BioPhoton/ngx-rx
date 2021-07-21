export type PickSlice<T extends object, K extends keyof T> = Pick<T,
  { [I in K]: I }[K]>;
