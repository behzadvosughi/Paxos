import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';
import { useSimulationStore } from '../../src/store/simulation-store';

describe('Paxos Protocol Explorer UI', () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it('renders the dashboard, network nodes and legend', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /paxos protocol explorer/i })).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A3')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('L1')).toBeInTheDocument();
    expect(screen.getAllByText(/quorum/i).length).toBeGreaterThan(0);
  });

  it('adds real timeline events when stepping forward', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /step ▶/i }));
    expect(screen.getAllByText(/sends Prepare/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 events/)).toBeInTheDocument();
  });

  it('opens the node inspector when a node is selected', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /A1 acceptor/i }));
    expect(screen.getByText(/promised ballot/i)).toBeInTheDocument();
    expect(screen.getByText(/sent responses/i)).toBeInTheDocument();
  });
});
