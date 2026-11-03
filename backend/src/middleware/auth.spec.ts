import jwt from "jsonwebtoken";
import { requireAuth, AuthedRequest } from "./auth";

process.env.JWT_SECRET = "test-secret";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("requireAuth", () => {
  it("rejects a request with no token cookie", () => {
    const req = { cookies: {} } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid/expired token", () => {
    const req = { cookies: { token: "not-a-real-jwt" } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid token and attaches adminId", () => {
    const token = jwt.sign({ sub: "admin-123" }, process.env.JWT_SECRET as string);
    const req = { cookies: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.adminId).toBe("admin-123");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a token signed with a different secret", () => {
    const token = jwt.sign({ sub: "admin-123" }, "wrong-secret");
    const req = { cookies: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
