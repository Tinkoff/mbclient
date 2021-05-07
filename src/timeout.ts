const timeout = (time: number): Promise<void> =>
  new Promise(
    (resolve): void => {
      setTimeout(() => resolve(), time);
    }
  );

export default timeout;
