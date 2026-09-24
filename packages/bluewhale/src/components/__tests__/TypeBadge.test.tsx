import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypeBadge, type AddressType } from "../TypeBadge";

describe("TypeBadge", () => {
  it.each<AddressType>(["G", "M", "C"])("renders the %s badge", (type) => {
    render(<TypeBadge type={type} />);

    expect(screen.getByTitle(`${type}-address`)).toHaveTextContent(type);
  });

  it("renders nothing for UNKNOWN", () => {
    const { container } = render(<TypeBadge type="UNKNOWN" />);

    expect(container).toBeEmptyDOMElement();
  });
});
