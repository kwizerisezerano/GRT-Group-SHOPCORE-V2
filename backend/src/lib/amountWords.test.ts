import { describe, expect, it } from "vitest";

import { amountInWords } from "./amountWords";

/**
 * The written-out amount on a contract.
 *
 * Worth its own test because it is the defence against a figure being altered
 * after signing, and a defence that quietly says "one hundred eighty" for
 * 180,000 is worse than none — it looks authoritative and is wrong.
 */
describe("amountInWords", () => {
  it("writes the amounts a Rwandan subscription actually costs", () => {
    expect(amountInWords(15_000)).toBe("fifteen thousand");
    expect(amountInWords(180_000)).toBe("one hundred and eighty thousand");
    expect(amountInWords(45_500)).toBe("forty-five thousand five hundred");
    expect(amountInWords(1_200_000)).toBe("one million two hundred thousand");
  });

  it("handles the awkward end of the number line", () => {
    expect(amountInWords(0)).toBe("zero");
    expect(amountInWords(7)).toBe("seven");
    expect(amountInWords(13)).toBe("thirteen");
    expect(amountInWords(20)).toBe("twenty");
    expect(amountInWords(21)).toBe("twenty-one");
    expect(amountInWords(100)).toBe("one hundred");
    expect(amountInWords(101)).toBe("one hundred and one");
    expect(amountInWords(1_000)).toBe("one thousand");
  });

  it("rounds and refuses to go negative rather than printing nonsense", () => {
    // The figure beside it is rounded for display too, so the two must agree.
    expect(amountInWords(15_000.4)).toBe("fifteen thousand");
    expect(amountInWords(14_999.6)).toBe("fifteen thousand");

    // A negative subscription fee is not a thing; printing "minus" on a
    // contract would be worse than printing zero.
    expect(amountInWords(-5)).toBe("zero");
    expect(amountInWords(Number.NaN)).toBe("zero");
  });
});
