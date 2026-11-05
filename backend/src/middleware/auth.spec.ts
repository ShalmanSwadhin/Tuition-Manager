import jwt from "jsonwebtoken";
import { requireAuth, requireRole, AuthedRequest } from "./auth";

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

  it("accepts a valid token and attaches the user id and role", () => {
    const token = jwt.sign({ sub: "teacher-123", role: "teacher" }, process.env.JWT_SECRET as string);
    const req = { cookies: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: "teacher-123", role: "teacher" });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a pre-roles token (no role claim), forcing a fresh login", () => {
    const token = jwt.sign({ sub: "admin-123" }, process.env.JWT_SECRET as string);
    const req = { cookies: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a token signed with a different secret", () => {
    const token = jwt.sign({ sub: "admin-123", role: "admin" }, "wrong-secret");
    const req = { cookies: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("lets a listed role through", () => {
    const req = { user: { id: "t1", role: "teacher" } } as AuthedRequest;
    const next = jest.fn();
    requireRole("admin", "teacher")(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("403s any other role", () => {
    const req = { user: { id: "s1", role: "student" } } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();
    requireRole("admin", "teacher")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
