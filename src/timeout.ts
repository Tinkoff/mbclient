const timeout = async (time: number): Promise<void> =>
  new Promise(
    (resolve): void => {
      setTimeout(() => resolve(), time);
    }
  );

export default timeout;
