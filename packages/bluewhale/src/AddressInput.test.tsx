import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressInput } from "./AddressInput";

const G_ADDRESS = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";
const M_ADDRESS =
  "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG";
const C_ADDRESS = "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";

const CONTRACT_WARNING =
  "Contract addresses cannot be used for standard payments.";

function setup() {
  const user = userEvent.setup();
  render(<AddressInput />);
  const input = screen.getByPlaceholderText(/paste stellar address/i);
  return { user, input };
}

const memoInput = () => screen.queryByLabelText(/memo/i);

describe("AddressInput", () => {
  it("renders an empty input with no badge, memo, or warnings", () => {
    setup();

    expect(screen.queryByTitle(/-address$/)).not.toBeInTheDocument();
    expect(memoInput()).not.toBeInTheDocument();
    expect(screen.queryByText(/warnings:/i)).not.toBeInTheDocument();
  });

  it("detects a G-address, shows the G badge and the memo field", async () => {
    const { user, input } = setup();

    await user.type(input, G_ADDRESS);

    expect(input).toHaveValue(G_ADDRESS);
    expect(screen.getByTitle("G-address")).toHaveTextContent("G");
    expect(memoInput()).toBeInTheDocument();
    expect(screen.queryByText(/warnings:/i)).not.toBeInTheDocument();
  });

  it("detects a lowercase g-address as G", async () => {
    const { user, input } = setup();

    await user.type(input, G_ADDRESS.toLowerCase());

    expect(screen.getByTitle("G-address")).toBeInTheDocument();
  });

  it("detects an M-address, shows the M badge and hides the memo field", async () => {
    const { user, input } = setup();

    await user.type(input, M_ADDRESS);

    expect(screen.getByTitle("M-address")).toHaveTextContent("M");
    expect(memoInput()).not.toBeInTheDocument();
    expect(screen.queryByText(/warnings:/i)).not.toBeInTheDocument();
  });

  it("detects a C-address, shows the C badge and a contract warning", async () => {
    const { user, input } = setup();

    await user.type(input, C_ADDRESS);

    expect(screen.getByTitle("C-address")).toHaveTextContent("C");
    expect(screen.getByText(CONTRACT_WARNING)).toBeInTheDocument();
    expect(memoInput()).not.toBeInTheDocument();
  });

  it.each(["XYZ123", "S", "alice*example.com", "123"])(
    "treats invalid input %j as unknown: no badge, no warnings, memo offered",
    async (value) => {
      const { user, input } = setup();

      await user.type(input, value);

      expect(screen.queryByTitle(/-address$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/warnings:/i)).not.toBeInTheDocument();
      expect(memoInput()).toBeInTheDocument();
    },
  );

  it("hides the memo field when a G-address is replaced by an M-address", async () => {
    const { user, input } = setup();

    await user.type(input, G_ADDRESS);
    expect(memoInput()).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, M_ADDRESS);
    expect(memoInput()).not.toBeInTheDocument();
  });

  it("clears the badge and warning when the input is emptied", async () => {
    const { user, input } = setup();

    await user.type(input, C_ADDRESS);
    await user.clear(input);

    expect(screen.queryByTitle(/-address$/)).not.toBeInTheDocument();
    expect(screen.queryByText(CONTRACT_WARNING)).not.toBeInTheDocument();
  });

  it("keeps the typed memo value for a G-address", async () => {
    const { user, input } = setup();

    await user.type(input, G_ADDRESS);
    await user.type(screen.getByLabelText(/memo/i), "12345");

    expect(screen.getByLabelText(/memo/i)).toHaveValue("12345");
  });
});
