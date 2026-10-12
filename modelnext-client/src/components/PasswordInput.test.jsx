import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PasswordInput from "./PasswordInput";

test("password visibility toggles independently and retains input values", () => {
  let typedValue;
  const onPasswordChange = jest.fn((event) => {
    typedValue = event.target.value;
  });
  const onConfirmationChange = jest.fn();
  render(<>
    <label>Password<PasswordInput aria-label="Password value" value="first-value" onChange={onPasswordChange} /></label>
    <label>Confirm password<PasswordInput aria-label="Confirm password value" value="second-value" onChange={onConfirmationChange} /></label>
  </>);

  const password = screen.getByLabelText("Password value");
  const confirmation = screen.getByLabelText("Confirm password value");
  expect(password).toHaveAttribute("type", "password");
  expect(confirmation).toHaveAttribute("type", "password");
  fireEvent.change(password, { target: { value: "typed-value" } });
  expect(onPasswordChange).toHaveBeenCalled();
  expect(typedValue).toBe("typed-value");
  expect(onConfirmationChange).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
  expect(password).toHaveAttribute("type", "text");
  expect(confirmation).toHaveAttribute("type", "password");
  expect(password).toHaveValue("first-value");

  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(confirmation).toHaveAttribute("type", "text");
  fireEvent.click(screen.getAllByRole("button", { name: "Hide password" })[0]);
  expect(password).toHaveAttribute("type", "password");
  expect(confirmation).toHaveAttribute("type", "text");
});
