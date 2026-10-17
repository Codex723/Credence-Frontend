/**
 * @file Disclaimer.failure-boundary.test.tsx
 * @description Failure-boundary (rejection) coverage for Disclaimer.
 *
 * Covers the isSafeHref classifier boundary directly, plus the DOM-level
 * guarantee that an unsafe href never becomes a clickable, potentially
 * script-executing link. Unsafe schemes (javascript:, data:, vbscript:),
 * protocol-relative URLs, empty/whitespace strings, non-http(s) schemes and
 * malformed URLs are all rejected.
 *
 * This is the component's only failure boundary: an unsafe href is treated like
 * a missing one and rendered as a disabled placeholder. No raw Error.message or
 * upstream failure detail is asserted — only the user-visible placeholder
 * outcome (invariant SEC-1, documented in Disclaimer.tsx).
 *
 * Determinism rules:
 * - No timers, no network. All renders are synchronous.
 * - Assertions read the DOM or the exported classifier, never internals.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Disclaimer, { isSafeHref } from './Disclaimer'

vi.mock('./Disclaimer.css', () => ({}))

describe('Disclaimer — isSafeHref classifier (SEC-1 unit boundary)', () => {
  it.each([
    // Unsafe schemes that must never become clickable links.
    ['javascript:alert(1)', false],
    ['JavaScript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['vbscript:msgbox(1)', false],
    // Protocol-relative URLs resolve to an attacker-chosen host.
    ['//evil.com/x', false],
    ['//', false],
    // Empty / whitespace-only.
    ['', false],
    ['   ', false],
    // Non-http(s) schemes.
    ['ftp://files.example.com', false],
    ['mailto:foo@bar.com', false],
    ['tel:+1234', false],
    ['file:///etc/passwd', false],
    // Malformed URL that throws inside the URL parser.
    ['http://host:notaport', false],
  ] as const)('rejects %s', (href) => {
    expect(isSafeHref(href)).toBe(false)
  })

  it.each([
    ['https://credence.org/legal/terms', true],
    ['http://localhost:3000', true],
    ['HTTP://CREDENCE.ORG', true],
    ['/legal/terms', true],
    ['/', true],
    ['#section', true],
    ['#', true],
    ['  https://credence.org/x  ', true],
  ] as const)('accepts %s', (href) => {
    expect(isSafeHref(href)).toBe(true)
  })
})

describe('Disclaimer — unsafe hrefs never render as links (SEC-1 DOM boundary)', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    '//evil.com/x',
    '',
    '   ',
    'ftp://files.example.com',
    'mailto:foo@bar.com',
    'http://host:notaport',
  ] as const)('renders a disabled placeholder, never a link, for termsHref %s', (termsHref) => {
    render(<Disclaimer termsHref={termsHref} />)
    expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    expect(document.querySelectorAll('a')).toHaveLength(0)
    const placeholder = screen.getByText(/Full terms & conditions/)
    expect(placeholder.tagName).toBe('SPAN')
    expect(placeholder).toHaveAttribute('aria-disabled', 'true')
    expect(placeholder).toHaveAttribute('tabindex', '-1')
    expect(placeholder).toHaveAttribute('title', 'Coming soon')
    expect(placeholder).not.toHaveAttribute('href')
  })

  it('treats javascript: XSS payload as a placeholder, not an executable link', () => {
    render(<Disclaimer termsHref="javascript:alert(1)" />)
    expect(document.querySelectorAll('a')).toHaveLength(0)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it(
    'renders a disabled placeholder for an unsafe learnMoreHref without affecting a safe terms link',
    () => {
      render(<Disclaimer termsHref="/legal/terms" learnMoreHref="javascript:alert(1)" />)
      expect(
        screen.getByRole('link', { name: /read full terms/i })
      ).toHaveAttribute('href', '/legal/terms')
      expect(screen.queryByRole('link', { name: /learn more/i })).not.toBeInTheDocument()
      expect(screen.getByText('Learn more')).toHaveAttribute('aria-disabled', 'true')
    }
  )
})

