import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("accepts the password that was hashed and rejects a different one", () => {
    const stored = hashPassword("Demo1234!");
    expect(verifyPassword("Demo1234!", stored)).toBe(true);
    expect(verifyPassword("wrong-password", stored)).toBe(false);
    expect(verifyPassword("Demo1234!", "not-a-hash")).toBe(false);
  });
});
