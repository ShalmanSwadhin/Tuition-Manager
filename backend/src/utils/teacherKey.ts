import { randomInt } from "crypto";
import User from "../models/User";

// No 0/O or 1/I/L, so keys survive being read out loud or typed on a phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

export function randomTeacherKey(): string {
  let key = "";
  for (let i = 0; i < LENGTH; i++) key += ALPHABET[randomInt(ALPHABET.length)];
  return key;
}

export async function generateUniqueTeacherKey(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = randomTeacherKey();
    if (!(await User.exists({ teacherKey: key }))) return key;
  }
  throw new Error("Could not generate a unique teacher key");
}
