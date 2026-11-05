// Stand-in for a Mongoose query in mocked-model tests: every chain method
// (.sort/.populate/...) returns the same object, and awaiting it resolves to
// `result` -- or rejects with `error`, to simulate a DB failure.
export function mockQuery<T>(result: T, error?: Error): any {
  const q: any = {};
  for (const m of ["sort", "populate", "select", "limit", "lean"]) q[m] = jest.fn(() => q);
  q.then = (onOk: any, onErr: any) => (error ? Promise.reject(error) : Promise.resolve(result)).then(onOk, onErr);
  return q;
}
