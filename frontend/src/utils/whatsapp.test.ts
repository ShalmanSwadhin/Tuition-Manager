import { describe, it, expect } from "vitest";
import { toWhatsAppNumber, diaryMessage, whatsappUrl } from "./whatsapp";

describe("toWhatsAppNumber", () => {
  it("adds the Bangladesh country code to local numbers", () => {
    expect(toWhatsAppNumber("01712345678")).toBe("8801712345678");
    expect(toWhatsAppNumber("01712-345 678")).toBe("8801712345678");
    expect(toWhatsAppNumber("1712345678")).toBe("8801712345678");
  });

  it("keeps numbers that already have a country code", () => {
    expect(toWhatsAppNumber("+8801712345678")).toBe("8801712345678");
    expect(toWhatsAppNumber("8801712345678")).toBe("8801712345678");
    expect(toWhatsAppNumber("+44 7700 900123")).toBe("447700900123");
  });

  it("rejects empty or too-short input", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("12345")).toBeNull();
  });
});

describe("diaryMessage", () => {
  it("includes only the filled-in fields and signs with the teacher's name", () => {
    const text = diaryMessage({ date: "2026-11-05", subject: "Math", homework: "Ex 1.1" }, "Rafi", "Ms Rahman");
    expect(text).toContain("Rafi");
    expect(text).toContain("Thu, 5 Nov 2026 · Math");
    expect(text).toContain("Homework: Ex 1.1");
    expect(text).not.toContain("Topic:");
    expect(text.endsWith("— Ms Rahman")).toBe(true);
  });
});

describe("whatsappUrl", () => {
  it("targets the guardian's number with the text encoded", () => {
    expect(whatsappUrl("Hi & bye", "01712345678")).toBe("https://wa.me/8801712345678?text=Hi%20%26%20bye");
  });

  it("falls back to the chat picker without a number", () => {
    expect(whatsappUrl("Hi")).toBe("https://wa.me/?text=Hi");
  });
});
