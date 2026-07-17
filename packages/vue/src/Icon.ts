import { computed, defineComponent, h, onMounted, type PropType, type CSSProperties } from 'vue'
import * as IconifyVue from '@iconify/vue'
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/vue'
import {
  buildIconStyle,
  getA11yAttributes,
  isDev,
  parseName,
  warnMissingA11y,
} from '@JasonTuTu2/icons-core'
import { iconifyIconExists } from './iconifyCompat.js'

registerCustomIcons()

const { Icon: IconifyIcon } = IconifyVue

export const Icon = defineComponent({
  name: 'GvIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String] as PropType<number | string>, default: undefined },
    color: { type: String, default: undefined },
    label: { type: String, default: undefined },
    decorative: { type: Boolean, default: false },
    class: { type: String, default: undefined },
    style: { type: Object as PropType<CSSProperties>, default: undefined },
    rotate: { type: Number, default: undefined },
  },
  setup(props) {
    const parsed = computed(() => {
      try {
        return parseName(props.name)
      } catch (err) {
        if (isDev()) {
          console.warn(err)
        }
        return null
      }
    })

    const a11y = computed(() =>
      getA11yAttributes({ label: props.label, decorative: props.decorative }),
    )

    const mergedStyle = computed(
      () =>
        buildIconStyle({
          size: props.size,
          color: props.color,
          style: props.style as Record<string, string | number | undefined>,
          rotate: props.rotate,
        }) as CSSProperties,
    )

    onMounted(() => {
      warnMissingA11y(props.name, {
        label: props.label,
        decorative: props.decorative,
      })
    })

    return () => {
      const p = parsed.value
      if (!p) {
        return h('span', {
          class: props.class,
          style: mergedStyle.value,
          'data-icon-missing': props.name,
          'aria-hidden': true,
        })
      }

      if (p.provider === 'custom' && !iconifyIconExists(IconifyVue, p.id)) {
        if (isDev()) {
          console.warn(
            `[Icons] Custom icon "${props.name}" was not found in the custom icons package. ` +
              'Publish/upgrade the package after adding the SVG, or check the kebab name.',
          )
        }
        return h('span', {
          class: props.class,
          style: mergedStyle.value,
          'data-icon-missing': props.name,
          'aria-hidden': true,
        })
      }

      return h(IconifyIcon, {
        icon: p.id,
        class: props.class,
        style: mergedStyle.value,
        ...a11y.value,
      })
    }
  },
})
