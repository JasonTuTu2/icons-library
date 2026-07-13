import { describe, expect, it, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as AntIcons from '@ant-design/icons-vue'
import { Icon, registerAntIcons } from '../src/index.js'

beforeAll(() => {
  registerAntIcons(AntIcons as never)
})

describe('Icon', () => {
  it('renders an ant icon with label', async () => {
    const wrapper = mount(Icon, {
      props: { name: 'ant:HomeOutlined', label: 'Home' },
    })
    await flushPromises()
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.attributes('aria-label')).toBe('Home')
  })

  it('marks decorative icons', async () => {
    const wrapper = mount(Icon, {
      props: { name: 'ant:UserOutlined', decorative: true },
    })
    await flushPromises()
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
