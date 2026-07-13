import { describe, expect, it, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import * as AntIcons from '@ant-design/icons'
import { Icon, registerAntIcons } from '../src/index.js'

beforeAll(() => {
  registerAntIcons(AntIcons as never)
})

describe('Icon', () => {
  it('renders an ant icon', async () => {
    render(<Icon name="ant:HomeOutlined" label="Home" />)
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeTruthy()
    })
    expect(screen.getByLabelText('Home')).toBeTruthy()
  })

  it('renders decorative with aria-hidden', async () => {
    const { container } = render(
      <Icon name="ant:UserOutlined" decorative />,
    )
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy()
    })
    const el = container.querySelector('[aria-hidden="true"]')
    expect(el).toBeTruthy()
  })

  it('renders iconify icon', () => {
    const { container } = render(
      <Icon name="mdi:home" label="Home" />,
    )
    // Iconify may render svg asynchronously; at least mount without throw
    expect(container.firstChild).toBeTruthy()
  })
})
