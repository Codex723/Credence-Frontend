/**
 * @file Disclaimer.recovery.test.tsx
 * @description Recovery and regression coverage for Disclaimer.
 *
 * Disclaimer is stateless and synchronous, so "recovery" means a later render
 * with a safe href restores a clickable link after an earlier unsafe href was
 * rendered as a disabled placeholder, and vice-versa, with no stale DOM and no
 * lost content.
 *
 * These tests extend the happy-path / boundary suite in Disclaimer.test.tsx with:
 *  - unsafe termsHref -> safe termsHref (error -> recovery)
 *  - safe termsHref -> unsafe termsHref (recovery -> error)
 *  - learnMoreHref toggling between safe and unsafe without stale links
 *  - context added then removed (no body-text loss)
 *  - terms href changed without body-text loss
 *  - exactly one disclaimer region and one body line regardless of prop churn
 *  - identical re-renders produce no duplicate links or placeholders
 *
 * Determinism rules:
 * - No timers, no network. All renders are synchronous via rerender.
 * - Assertions read the DOM, never implementation internals.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Disclaimer from './Disclaimer'

vi.mock('./Disclaimer.css', () => ({}))

describe('Disclaimer — recovery: unsafe <-> safe href transitions', () => {
  it('recovers a clickable terms link after an unsafe href is corrected', () => {
    const { rerender } = render(<Disclaimer termsHref="javascript:alert(1)" />)

    // Failure state: unsafe href renders a disabled placeholder, never a link.
    expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    expect(screen.getByText('Full terms & conditions')).toHaveAttribute('aria-disabled', 'true')

    // Recovery: a safe href restores the clickable link.
    rerender(<Disclaimer termsHref="https://credence.org/legal/terms" />)
    const link = screen.getByRole('link', { name: /read full terms/i })
    expect(link).toHaveAttribute('href', 'https://credence.org/legal/terms')
    expect(link).not.toHaveAttribute('aria-disabled')
  })

  it('demotes a safe link back to a disabled placeholder when the href becomes unsafe', () => {
    const { rerender } = render(<Disclaimer termsHref="https://credence.org/legal/terms" />)

    expect(screen.getByRole('link', { name: /read full terms/i })).toHaveAttribute(
      'href',
      'https://credence.org/legal/terms'
    )

    rerender(<Disclaimer termsHref="javascript:alert(1)" />)
    expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    expect(screen.getByText('Full terms & conditions')).toHaveAttribute('aria-disabled', 'true')
  })

  it('toggles learnMoreHref between safe and unsafe without leaving a stale link', () => {
    const { rerender } = render(<Disclaimer learnMoreHref="https://credence.org/docs" />)
    expect(screen.getByRole('link', { name: /learn more about the terms/i })).toHaveAttribute(
      'href',
      'https://credence.org/docs'
    )

    rerender(<Disclaimer learnMoreHref="data:text/html,<script>alert(1)>" />)
    expect(
      screen.queryByRole('link', { name: /learn more about the terms/i })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Learn more')).toHaveAttribute('aria-disabled', 'true')

    rerender(<Disclaimer learnMoreHref="/docs/risks" />)
    expect(
      screen.getByRole('link', { name: /learn more about the terms/i })
    ).toHaveAttribute('href', '/docs/risks')
  })
})

describe('Disclaimer — regression: no data loss across re-renders', () => {
  it('keeps the disclaimer body text when context is added then removed', () => {
    const { rerender } = render(<Disclaimer />)
    expect(screen.getByText(/this is not financial advice/i)).toBeInTheDocument()

    rerender(<Disclaimer context="This page involves leveraged positions." />)
    expect(screen.getByText('This page involves leveraged positions.')).toBeInTheDocument()
    expect(screen.getByText(/this is not financial advice/i)).toBeInTheDocument()

    rerender(<Disclaimer />)
    expect(screen.queryByText('This page involves leveraged positions.')).not.toBeInTheDocument()
    expect(screen.getByText(/this is not financial advice/i)).toBeInTheDocument()
  })

  it('keeps the disclaimer body text when the terms href changes', () => {
    const { rerender } = render(<Disclaimer termsHref="https://credence.org/legal/terms" />)
    expect(screen.getByText(/this is not financial advice/i)).toBeInTheDocument()

    rerender(<Disclaimer termsHref="/legal/terms" />)
    expect(screen.getByText(/this is not financial advice/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /read full terms/i })
    ).toHaveAttribute('href', '/legal/terms')
  })

  it('renders exactly one disclaimer region and one body line regardless of prop churn', () => {
    const { rerender } = render(<Disclaimer />)
    const propSets = [
      {},
      { context: 'a' },
      { context: 'b', termsHref: 'https://example.com/terms' },
      { learnMoreHref: 'https://example.com/docs' },
      { termsHref: "javascript:alert(1)" },
      {},
    ]
    for (const props of propSets) {
      rerender(<Disclaimer {...props} />)
    }
    expect(screen.getAllByRole('region', { name: /risk disclaimer/i })).toHaveLength(1)
    expect(screen.getAllByText(/this is not financial advice/i)).toHaveLength(1)
  })

  it('is stable under identical re-renders (no duplicate links or placeholders)', () => {
    const props = {
      context: 'note',
      termsHref: 'https://credence.org/legal/terms',
      learnMoreHref: 'https://credence.org/docs',
    } as const
    const { rerender } = render(<Disclaimer {...props} />)
    rerender(<Disclaimer {...props} />)
    rerender(<Disclaimer {...props} />)
    expect(screen.getAllByRole('link', { name: /read full terms/i })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /learn more about the terms/i })).toHaveLength(1)
    expect(screen.getAllByText('Full terms & conditions')).toHaveLength(1)
    expect(screen.getAllByText('Learn more')).toHaveLength(1)
  })
})
