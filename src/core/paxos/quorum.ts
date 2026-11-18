/**
 * A quorum is a strict majority of acceptors: `floor(N / 2) + 1`.
 * Any two quorums of the same acceptor set therefore intersect.
 */
export function quorumSize(acceptorCount: number): number {
  return Math.floor(acceptorCount / 2) + 1;
}
