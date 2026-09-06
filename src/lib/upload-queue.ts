/** Remove only acknowledged uploads, so retries never resend completed pages. */
export async function flushUploads<T>(
  pending: File[],
  send: (file: File) => Promise<T>,
  accepted: (result: T, file: File) => void,
  paused: () => boolean = () => false
) {
  while (pending.length && !paused()) {
    const file = pending[0];
    const result = await send(file);
    pending.shift();
    accepted(result, file);
  }
}
