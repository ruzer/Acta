import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Metric } from "./Visibility";
afterEach(cleanup);
describe("Metric user-visible contract", () => {
  it("shows numerator denominator and no misleading percentage for empty universe", () => {
    render(
      <Metric
        label="Validación"
        value={{ numerator: 0, denominator: 0, percentage: null }}
      />,
    );
    expect(screen.getByText("0 / 0")).toBeVisible();
    expect(screen.getByText("Sin preguntas")).toBeVisible();
    expect(screen.queryByText("100 %")).not.toBeInTheDocument();
  });
  it("keeps counts visible with percentage", () => {
    render(
      <Metric
        label="Cierre"
        value={{ numerator: 21, denominator: 30, percentage: 70 }}
      />,
    );
    expect(screen.getByText("21 / 30")).toBeVisible();
    expect(screen.getByText("70 %")).toBeVisible();
  });
});
