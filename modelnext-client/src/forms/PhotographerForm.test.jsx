import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PhotographerForm from "./PhotographerForm";

test("photographer matching fields, required indicators, and password toggles are preserved", () => {
  render(<MemoryRouter><PhotographerForm /></MemoryRouter>);

  expect(screen.getByRole("button", { name: "Photography styles" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Professional skills" })).toBeInTheDocument();
  expect(screen.getAllByText("*", { selector: ".photographer-required-indicator" })).toHaveLength(9);
  expect(screen.getByRole("textbox", { name: /Full name/ })).toBeRequired();
  expect(screen.getByRole("textbox", { name: /Portfolio website/ })).not.toBeRequired();

  const password = screen.getByLabelText(/Password/);
  const confirmation = screen.getByLabelText(/Confirm password/);
  expect(password).toHaveAttribute("type", "password");
  expect(confirmation).toHaveAttribute("type", "password");
  fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
  expect(password).toHaveAttribute("type", "text");
  expect(confirmation).toHaveAttribute("type", "password");
});
