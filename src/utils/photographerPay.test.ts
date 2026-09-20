import { describe, expect, it } from "vitest";
import { computePhotographerPayForShoot, formatPay } from "./photographerPay";

describe("computePhotographerPayForShoot", () => {
  it("sums only the viewer’s assigned services and multiplies quantity", () => {
    const shoot = {
      photographer: { id: 8 },
      services: [
        { photographer_id: 8, photographer_pay: 40, quantity: 2 },
        { photographer_id: 12, photographer_pay: 90, quantity: 1 },
      ],
    };

    expect(computePhotographerPayForShoot(shoot, 8)).toBe(80);
    expect(computePhotographerPayForShoot(shoot, 12)).toBe(90);
    expect(computePhotographerPayForShoot(shoot, 99)).toBeNull();
  });

  it("falls back to the shoot rollup for a legacy single-photographer shoot", () => {
    const shoot = {
      photographer_id: 8,
      totalPhotographerPay: 125.5,
      services: [{ photographer_pay: 125.5, quantity: 1 }],
    };

    expect(computePhotographerPayForShoot(shoot, 8)).toBe(125.5);
    expect(computePhotographerPayForShoot(shoot, 8)).toBe(125.5);
  });

  it("keeps an explicit zero instead of inventing a fallback", () => {
    expect(
      computePhotographerPayForShoot(
        {
          photographer: { id: 8 },
          services: [{ photographer_id: 8, photographer_pay: 0, quantity: 1 }],
          totalPhotographerPay: 200,
        },
        8,
      ),
    ).toBe(0);
  });

  it("returns null when pay is missing rather than $0.00", () => {
    expect(computePhotographerPayForShoot({ photographer: { id: 8 }, services: [] }, 8)).toBeNull();
    expect(computePhotographerPayForShoot(null, 8)).toBeNull();
    expect(formatPay(80)).toBe("$80.00");
  });
});
