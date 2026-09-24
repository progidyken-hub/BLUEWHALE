import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarningList } from "../WarningList";

describe("WarningList", () => {
  it("renders nothing when there are no warnings", () => {
    const { container } = render(<WarningList warnings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders each warning as a list item", () => {
    render(<WarningList warnings={["first warning", "second warning"]} />);

    expect(screen.getByText(/warnings:/i)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("first warning");
    expect(items[1]).toHaveTextContent("second warning");
  });
});
