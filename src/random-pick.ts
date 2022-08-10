export default function randomPickConnectionString(connections: string[]): string {
  // @ts-expect-error: Type 'string | undefined' is not assignable to type 'string'.
  return connections[Math.floor(Math.random() * connections.length)];
}
