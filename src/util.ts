export const sleep = (milliseconds: number) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(() => resolve(), milliseconds)
  );
