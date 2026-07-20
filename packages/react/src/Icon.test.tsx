import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { Icon } from '../src/index.js'

describe('Icon', () => {
  it('mounts a brand icon without throwing', () => {
    const { container } = render(
      <Icon name="ci:call-filled" label="Call" />,
    )
    // Iconify may render svg asynchronously; at least mount without throw
    expect(container.firstChild).toBeTruthy()
  })

  it('renders decorative brand icon', async () => {
    const { container } = render(
      <Icon name="ci:call-filled" decorative />,
    )
    expect(container.firstChild).toBeTruthy()
    await waitFor(() => {
      expect(
        container.querySelector('svg') || container.querySelector('[aria-hidden]'),
      ).toBeTruthy()
    })
  })
})
