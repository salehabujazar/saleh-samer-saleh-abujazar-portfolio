// Password hashing with Node's built-in scrypt, a memory-hard algorithm designed
// for passwords. No extra dependency is needed and nothing native must be compiled.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// Cost settings. Higher N = slower to brute-force. 2^15 takes roughly 50-100 ms per check.
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

export const MIN_PASSWORD_LENGTH = 12;

/** Returns a string like "scrypt$32768$8$1$<salt>$<hash>" that is safe to store. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, {
    N: COST, r: BLOCK_SIZE, p: PARALLELISM, maxmem: MAX_MEMORY,
  });
  return ['scrypt', COST, BLOCK_SIZE, PARALLELISM, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, saltText, hashText] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;

  const expected = Buffer.from(hashText, 'base64');
  const actual = await scrypt(password, Buffer.from(saltText, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
  });
  // timingSafeEqual prevents attackers from learning anything from response times.
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Used when a username does not exist, so failed logins take the same time either way.
let dummyHashPromise;
export function getDummyHash() {
  dummyHashPromise ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}
