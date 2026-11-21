import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

function Harness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>mở</button>
    <Modal open={open} onClose={() => { onClose(); setOpen(false); }} title="Hộp thoại thử">
      <button>một</button><button>hai</button>
    </Modal>
  </>;
}

describe('Modal', () => {
  it('has dialog semantics and focuses the first control', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('mở'));
    const d = screen.getByRole('dialog', { name: 'Hộp thoại thử' });
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('một')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape, restores focus and body scroll', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText('mở');
    opener.focus(); fireEvent.click(opener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes on backdrop click but not on clicks inside', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('mở'));
    fireEvent.mouseDown(screen.getByText('một'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('mở'));
    screen.getByText('hai').focus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab' });
    expect(screen.getByText('một')).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('hai')).toHaveFocus();
  });

  it('ignores Escape and backdrop when not dismissible', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} dismissible={false} title="x"><button>a</button></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(onClose).not.toHaveBeenCalled();
  });
});
