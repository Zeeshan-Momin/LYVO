import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Loading from "../components/common/Loading";

describe("Loading Component Test", () => {
  it("renders a standard spinner by default", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("renders fullscreen loader with branded text", () => {
    render(<Loading fullscreen={true} />);
    expect(screen.getByText("LYVO")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
