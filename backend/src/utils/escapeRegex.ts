// Escape user input before using it inside a MongoDB $regex, so a search
// for "a+b" or "(" matches literally instead of erroring or backtracking.
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
