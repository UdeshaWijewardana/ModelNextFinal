import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientForm from './ClientForm';
import AgencyForm from './AgencyForm';
import PhotographerForm from './PhotographerForm';

const json = (data, status = 201) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => data });
beforeEach(() => {
  global.fetch = jest.fn(async () => json({ message: 'Created' }));
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
});

test.each([
  [ClientForm, 'Create your account'],
  [AgencyForm, 'Create your agency account'],
  [PhotographerForm, 'Create your account'],
])('%p uses compact registration navigation without the public navbar', (Component, heading) => {
  render(<MemoryRouter><Component /></MemoryRouter>);
  expect(screen.getByRole('navigation', { name: 'Registration navigation' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Website' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
});

test('client form shows accessible validation and sends normalized supported fields', async () => {
  render(<MemoryRouter><ClientForm /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create client account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Complete every required field');
  const values = { 'Client type': 'individual', 'Full name': 'Client One', Username: 'client.one', 'Phone number': '+94 771234567', 'Email address': 'client@example.com', 'Address or location': 'Colombo', Password: 'password1', 'Confirm password': 'password1' };
  for (const [label, value] of Object.entries(values)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create client account' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ type: 'individual', username: 'client.one', email: 'client@example.com' });
});

test('agency logo and cover have independent previews, remove controls, and file validation', () => {
  render(<MemoryRouter><AgencyForm /></MemoryRouter>);
  const logo = new File(['logo'], 'logo.png', { type: 'image/png' });
  const cover = new File(['cover'], 'cover.webp', { type: 'image/webp' });
  fireEvent.change(screen.getByLabelText('Choose agency logo'), { target: { files: [logo] } });
  fireEvent.change(screen.getByLabelText('Choose cover image'), { target: { files: [cover] } });
  expect(screen.getByAltText('Selected agency logo preview')).toHaveAttribute('src', 'blob:preview');
  expect(screen.getByAltText('Selected cover image preview')).toHaveAttribute('src', 'blob:preview');
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Replace cover image'), { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG, or WebP');
});
