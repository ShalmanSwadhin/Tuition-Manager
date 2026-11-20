import bcrypt from "bcryptjs";
import User from "../models/User";
import { resetPassword } from "./resetPassword";

jest.mock("../models/User");
const mockedUser = User as jest.Mocked<typeof User>;

beforeEach(() => jest.clearAllMocks());

it("sets a new password hash for an existing account", async () => {
  const user = { role: "admin", passwordHash: "old-hash", save: jest.fn().mockResolvedValue(undefined) };
  mockedUser.findOne.mockResolvedValue(user as any);

  const result = await resetPassword("  Admin@Example.com ", "brand-new-password");

  expect(result).toEqual({ ok: true, role: "admin" });
  expect(mockedUser.findOne).toHaveBeenCalledWith({ email: "admin@example.com" });
  expect(user.passwordHash).not.toBe("old-hash");
  expect(await bcrypt.compare("brand-new-password", user.passwordHash)).toBe(true);
  expect(user.save).toHaveBeenCalledTimes(1);
});

it("refuses a password shorter than the sign-up minimum, before touching the database", async () => {
  const result = await resetPassword("admin@example.com", "12345");
  expect(result.ok).toBe(false);
  expect(mockedUser.findOne).not.toHaveBeenCalled();
});

it("reports an unknown email and changes nothing", async () => {
  mockedUser.findOne.mockResolvedValue(null as any);
  const result = await resetPassword("nobody@example.com", "long-enough");
  expect(result).toEqual({ ok: false, reason: "No account found for nobody@example.com." });
});
