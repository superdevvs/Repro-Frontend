import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrokerageLogoCard } from './BrokerageLogoCard';
import type { BrokerageLogo } from '@/services/brokerageLogoService';

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { id: 'viewer' }, role: 'client' }) }));
vi.mock('@/services/api', () => ({ apiClient: {} }));
vi.mock('@/services/brokerageLogoService', async (original) => ({
  ...await original<typeof import('@/services/brokerageLogoService')>(),
  getBrokerageLogo: mocks.get,
  saveBrokerageLogo: mocks.save,
}));

function mount(props: Partial<React.ComponentProps<typeof BrokerageLogoCard>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><BrokerageLogoCard userId="42" company="Example Realty" {...props} /></QueryClientProvider>);
}

const upload = (file = new File(['png'], 'logo.png', { type: 'image/png' })) => {
  fireEvent.change(screen.getByLabelText('Upload brokerage logo'), { target: { files: [file] } });
  return file;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ logo: '/old-logo.png', can_manage: true });
  mocks.save.mockResolvedValue({ logo: '/new-logo.png', can_manage: true });
});
afterEach(cleanup);

describe('brokerage logo controls', () => {
  it('loads the saved logo without cropping it and uploads to the target client', async () => {
    mount();
    const image = await screen.findByAltText('Example Realty logo');
    expect(image).toHaveAttribute('src', '/old-logo.png');
    expect(image).toHaveClass('object-contain');
    const file = upload();
    await screen.findByText('Brokerage logo saved.');
    expect(mocks.save).toHaveBeenCalledWith('42', file);
    expect(image).toHaveAttribute('src', '/new-logo.png');
    expect(mocks.get).toHaveBeenCalledWith('42');
  });

  it('retains the saved preview on failure and allows retrying the same file', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Network failed'));
    mount();
    await screen.findByRole('button', { name: 'Replace logo' });
    const file = upload();
    await screen.findByRole('alert');
    expect(screen.getByAltText('Example Realty logo')).toHaveAttribute('src', '/old-logo.png');
    expect(screen.queryByText('Brokerage logo saved.')).not.toBeInTheDocument();
    upload(file);
    await screen.findByText('Brokerage logo saved.');
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it.each([
    new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }),
    new File(['pdf'], 'logo.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
  ])('rejects invalid files before making a request ($name)', async (file) => {
    mount();
    await screen.findByRole('button', { name: 'Replace logo' });
    upload(file);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByAltText('Example Realty logo')).toHaveAttribute('src', '/old-logo.png');
  });

  it('removes the saved logo and offers upload again', async () => {
    mocks.save.mockResolvedValue({ logo: null, can_manage: true });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await screen.findByText('Brokerage logo removed.');
    expect(mocks.save).toHaveBeenCalledWith('42', null);
    expect(screen.queryByAltText('Example Realty logo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload logo' })).toBeInTheDocument();
  });

  it('shows a saved logo without any management controls when the API denies editing', async () => {
    mocks.get.mockResolvedValue({ logo: '/old-logo.png', can_manage: false });
    mount();
    await screen.findByAltText('Example Realty logo');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upload brokerage logo')).not.toBeInTheDocument();
  });

  it('does not show an empty upload block to a viewer without management permission', async () => {
    mocks.get.mockResolvedValue({ logo: null, can_manage: false });
    const view = mount();
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('offers a summary edit shortcut only when both the API and parent allow editing', async () => {
    const edit = vi.fn();
    const view = mount({ variant: 'summary', onEdit: edit });
    fireEvent.click(await screen.findByRole('button', { name: 'Change logo' }));
    expect(edit).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Upload brokerage logo')).not.toBeInTheDocument();
    view.unmount();
    mocks.get.mockResolvedValue({ logo: '/old-logo.png', can_manage: false });
    mount({ variant: 'summary', onEdit: edit });
    await screen.findByAltText('Example Realty logo');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a load error and retries without exposing an upload control', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Forbidden'));
    mount();
    await screen.findByRole('alert');
    expect(screen.queryByLabelText('Upload brokerage logo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Replace logo' });
  });

  it('removes editing controls when a reassignment or permission change rejects an upload', async () => {
    mocks.save.mockRejectedValue(Object.assign(new Error('Forbidden'), { isAxiosError: true, response: { status: 403 } }));
    mount();
    await screen.findByRole('button', { name: 'Replace logo' });
    mocks.get.mockResolvedValue({ logo: '/old-logo.png', can_manage: false });
    upload();
    await screen.findByText('You no longer have permission to change this logo.');
    await waitFor(() => expect(screen.queryByLabelText('Upload brokerage logo')).not.toBeInTheDocument());
    expect(screen.getByAltText('Example Realty logo')).toHaveAttribute('src', '/old-logo.png');
  });

  it('keeps the saved preview when a slower background reload returns the previous logo', async () => {
    let finishSave!: (value: BrokerageLogo) => void;
    let finishReload!: (value: BrokerageLogo) => void;
    mocks.save.mockImplementation(() => new Promise<BrokerageLogo>(resolve => { finishSave = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><BrokerageLogoCard userId="42" company="Example Realty" /></QueryClientProvider>);
    await screen.findByRole('button', { name: 'Replace logo' });
    upload();
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    mocks.get.mockImplementationOnce(() => new Promise<BrokerageLogo>(resolve => { finishReload = resolve; }));
    void client.invalidateQueries({ queryKey: ['brokerage-logo'] });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    finishSave({ logo: '/new-logo.png', can_manage: true });
    await screen.findByText('Brokerage logo saved.');
    finishReload({ logo: '/old-logo.png', can_manage: true });
    await waitFor(() => expect(screen.getByAltText('Example Realty logo')).toHaveAttribute('src', '/new-logo.png'));
  });

  it('does not reuse a previous client preview when switching accounts during an upload', async () => {
    let finish!: (logo: BrokerageLogo) => void;
    mocks.save.mockImplementation(() => new Promise<BrokerageLogo>(resolve => { finish = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const content = (id: string) => <QueryClientProvider client={client}><BrokerageLogoCard userId={id} company="Example Realty" /></QueryClientProvider>;
    const view = render(content('42'));
    await screen.findByRole('button', { name: 'Replace logo' });
    upload();
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    mocks.get.mockResolvedValue({ logo: '/other-client.png', can_manage: false });
    view.rerender(content('99'));
    await waitFor(() => expect(screen.getByAltText('Example Realty logo')).toHaveAttribute('src', '/other-client.png'));
    finish({ logo: '/new-logo.png', can_manage: true });
    await waitFor(() => expect(client.getQueryData(['brokerage-logo', '42', 'viewer:client'])).toEqual({ logo: '/new-logo.png', can_manage: true }));
    expect(screen.getByAltText('Example Realty logo')).toHaveAttribute('src', '/other-client.png');
    expect(screen.queryByRole('button', { name: 'Replace logo' })).not.toBeInTheDocument();
  });
});
