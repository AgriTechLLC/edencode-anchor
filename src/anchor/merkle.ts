import { createHash } from 'crypto';

/**
 * Compute the SHA-256 hash of a string or Buffer and return it as a
 * lowercase hex string.
 */
export function sha256hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Build a Merkle tree over an array of leaf hashes (hex strings).
 *
 * - The bottom layer (layers[0]) is the array of leaves exactly as supplied.
 * - Each parent is sha256hex of the concatenation of its two children's hex
 *   strings (left + right).
 * - On an odd number of nodes in a layer, the last node is duplicated so it is
 *   paired with itself.
 * - For a single leaf, the root equals that leaf.
 * - For zero leaves, the root is the empty string.
 *
 * @returns the Merkle root and every layer from leaves (index 0) up to the
 *          single-node root layer.
 */
export function buildMerkle(leavesHex: string[]): { root: string; layers: string[][] } {
  if (leavesHex.length === 0) {
    return { root: '', layers: [[]] };
  }

  const layers: string[][] = [leavesHex.slice()];
  let current = leavesHex.slice();

  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      // Duplicate the last node when the count is odd.
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(sha256hex(left + right));
    }
    layers.push(next);
    current = next;
  }

  return { root: current[0], layers };
}

/**
 * Produce the Merkle proof (authentication path) for the leaf at `index`.
 *
 * Each step gives the sibling hash and whether that sibling sits to the
 * 'left' or 'right' of the running hash, which is what `verifyProof` needs to
 * recombine in the correct order.
 */
export function merkleProof(
  layers: string[][],
  index: number,
): Array<{ hash: string; position: 'left' | 'right' }> {
  const proof: Array<{ hash: string; position: 'left' | 'right' }> = [];

  if (layers.length === 0 || layers[0].length === 0) {
    return proof;
  }

  let idx = index;
  // Walk every layer except the root layer (the last one).
  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level];
    const isRightNode = idx % 2 === 1;
    const pairIndex = isRightNode ? idx - 1 : idx + 1;

    // If the sibling is out of range (odd count), the node was paired with
    // itself during construction.
    const siblingHash = pairIndex < layer.length ? layer[pairIndex] : layer[idx];

    proof.push({
      hash: siblingHash,
      // If our node is the right one, the sibling is on the left, and vice versa.
      position: isRightNode ? 'left' : 'right',
    });

    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a Merkle proof: recombine `leafHex` with each sibling in the proof
 * (respecting left/right ordering) and check the resulting root matches.
 *
 * For an empty proof, the leaf must equal the root (single-leaf tree).
 */
export function verifyProof(
  leafHex: string,
  proof: Array<{ hash: string; position: 'left' | 'right' }>,
  root: string,
): boolean {
  let computed = leafHex;

  for (const step of proof) {
    if (step.position === 'left') {
      computed = sha256hex(step.hash + computed);
    } else {
      computed = sha256hex(computed + step.hash);
    }
  }

  return computed === root;
}
