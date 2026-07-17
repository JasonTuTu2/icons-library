import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Icon } from '../src/index.js'

describe('Icon', () => {
  it('renders a brand icon with label', () => {
    const wrapper = mount(Icon, {
      props: { name: 'ci:v1-call-filled', label: 'Call' },
    })
    expect(wrapper.attributes('aria-label')).toBe('Call')
  })

  it('marks decorative icons', () => {
    const wrapper = mount(Icon, {
      props: { name: 'ci:v1-call-filled', decorative: true },
    })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
