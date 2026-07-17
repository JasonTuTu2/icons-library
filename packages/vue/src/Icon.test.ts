import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Icon } from '../src/index.js'

describe('Icon', () => {
  it('renders an iconify icon with label', () => {
    const wrapper = mount(Icon, {
      props: { name: 'mdi:home', label: 'Home' },
    })
    expect(wrapper.attributes('aria-label')).toBe('Home')
  })

  it('marks decorative icons', () => {
    const wrapper = mount(Icon, {
      props: { name: 'mdi:home', decorative: true },
    })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
