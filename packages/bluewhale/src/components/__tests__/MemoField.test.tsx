import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoField } from "../MemoField";

describe("MemoField", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <MemoField isVisible={false} value="" onChange={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText(/memo/i)).not.toBeInTheDocument();
  });

  it("renders a labelled input with the current value when visible", () => {
    render(<MemoField isVisible value="42" onChange={() => {}} />);

    const input = screen.getByLabelText(/memo/i);
    expect(input).toHaveValue("42");
    expect(
      screen.getByText(/a memo is sometimes required by exchanges/i),
    ).toBeInTheDocument();
  });

  it("calls onChange with the typed value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MemoField isVisible value="" onChange={onChange} />);

    await user.type(screen.getByLabelText(/memo/i), "7");

    expect(onChange).toHaveBeenCalledWith("7");
  });

  it("toggles between hidden and visible on rerender", () => {
    const { rerender } = render(
      <MemoField isVisible value="" onChange={() => {}} />,
    );
    expect(screen.getByLabelText(/memo/i)).toBeInTheDocument();

    rerender(<MemoField isVisible={false} value="" onChange={() => {}} />);
    expect(screen.queryByLabelText(/memo/i)).not.toBeInTheDocument();
  });
});
