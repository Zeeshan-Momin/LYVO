import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";
import ProductCard from "../components/product/ProductCard";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    toggleWishlist: vi.fn(),
    isWishlisted: vi.fn(() => false),
  }),
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({
    addItem: vi.fn(),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    img: (props) => <img {...props} />,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
}));

describe("ProductCard Component Test", () => {
  const dummyProduct = {
    _id: "123",
    name: "Classic Sneaker X",
    brand: "Adidas",
    price: 8000,
    discountPrice: 6000,
    discountPercent: 25,
    images: [{ url: "https://example.com/shoe.jpg" }],
    totalStock: 5,
    sizes: [{ size: "UK 9", stock: 5 }]
  };

  it("renders product name, brand, and discounts correctly", () => {
    render(
      <BrowserRouter>
        <ProductCard product={dummyProduct} />
      </BrowserRouter>
    );

    expect(screen.getByText("Classic Sneaker X")).toBeInTheDocument();
    expect(screen.getByText("Adidas")).toBeInTheDocument();
    expect(screen.getByText("₹6,000")).toBeInTheDocument();
    expect(screen.getByText("−25%")).toBeInTheDocument();
  });
});
