export function runTest(name: string, testFn: () => void): void {
  testFn();
  console.log(`[PASS] ${name}`);
}

export async function runAsyncTest(name: string, testFn: () => Promise<void>): Promise<void> {
  await testFn();
  console.log(`[PASS] ${name}`);
}
