const randomPickConnectionString = (connections: string[]): string =>
  connections[Math.floor(Math.random() * connections.length)];

export default randomPickConnectionString;
