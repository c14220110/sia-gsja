/**
 * Pure mathematical calculation of distance and similarity between two 1024-float face embeddings.
 * Matches @vladmandic/human bit-for-bit without loading TFJS/WASM on Vercel serverless.
 */
export interface CompareResult {
  distance: number;
  similarity: number;
}

export function compareFaceEmbeddings(
  embA: number[],
  embB: number[],
  options: { multiplier?: number; min?: number; max?: number } = {}
): CompareResult {
  if (!Array.isArray(embA) || !Array.isArray(embB) || embA.length !== 1024 || embB.length !== 1024) {
    throw new TypeError('Both face embeddings must be arrays of length 1024');
  }

  const multiplier = options.multiplier ?? 25;
  const min = options.min ?? 0.2;
  const max = options.max ?? 0.8;

  let sum = 0;
  for (let i = 0; i < 1024; i++) {
    const diff = Number(embA[i]) - Number(embB[i]);
    sum += diff * diff;
  }

  const distance = Math.round(100 * multiplier * sum) / 100;
  const norm = (1 - Math.sqrt(distance) / 100 - min) / (max - min);
  const similarity = Math.max(0, Math.min(1, Math.round(100 * norm) / 100));

  return { distance, similarity };
}
