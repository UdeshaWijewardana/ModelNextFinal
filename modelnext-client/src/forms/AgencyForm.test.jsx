import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgencyForm from "./AgencyForm";

test("agency required fields show stars while optional business ID and cover remain unstarred", () => {
  render(<MemoryRouter><AgencyForm /></MemoryRouter>);
  expect(screen.getAllByText("*", { selector: ".agency-required-indicator" })).toHaveLength(8);
  for (const label of [
    /Agency name/, /Owner name/, /Contact number/, /Email address/,
    /Office address/, /Password/, /Confirm password/,
  ]) expect(screen.getByLabelText(label)).toBeRequired();
  expect(screen.getByLabelText(/Business ID/)).not.toBeRequired();
  expect(screen.getByLabelText(/Choose cover image/)).not.toBeRequired();
});
