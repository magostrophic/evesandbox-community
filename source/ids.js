// Short post and reply ids made only of lower-case letters and digits (no 0, 1, l, o: easy to read out loud).
const A = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newId(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += A[b[i] % A.length];
  return s;
}
export const POST_ID = /^[a-z0-9]{8}$/;
