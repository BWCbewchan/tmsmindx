export function chooseNextEmailAccountId(
  orderedAccountIds: number[],
  previousAccountId: number | null,
): number | null {
  if (orderedAccountIds.length === 0) return null
  if (previousAccountId === null) return orderedAccountIds[0]

  const previousIndex = orderedAccountIds.indexOf(previousAccountId)
  if (previousIndex < 0 || previousIndex === orderedAccountIds.length - 1) {
    return orderedAccountIds[0]
  }

  return orderedAccountIds[previousIndex + 1]
}
