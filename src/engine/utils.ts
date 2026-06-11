export function weightedPick<T>(candidates: { value: T; weight: number }[]): T {
  const total = candidates.reduce((s, c) => s + c.weight, 0)
  if (total === 0) return candidates[Math.floor(Math.random() * candidates.length)].value
  let r = Math.random() * total
  for (const c of candidates) {
    r -= c.weight
    if (r <= 0) return c.value
  }
  return candidates[candidates.length - 1].value
}
