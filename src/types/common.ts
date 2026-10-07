export type ID = string;

export type ISODateString = string;

export interface Result<T> {
  ok: true;
  value: T;
}

export interface Failure {
  ok: false;
  error: string;
}

export type ServiceResult<T> = Result<T> | Failure;