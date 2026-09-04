/**
 * Keeps the smoke test request pending so it can prove the modal does not
 * wait for the network before unmounting.
 */
export function createEntry() {
  return new Promise<never>(() => undefined);
}

export function deleteEntry() {
  return Promise.resolve({ deleted: true });
}

export function verifyIntegrity() {
  return Promise.resolve({
    valid: true,
    entriesChecked: 9,
    deletedEntries: 8,
    pendingRedactionEntries: 8,
    visibleEntries: 1,
  });
}
