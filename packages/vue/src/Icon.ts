import { computed, defineComponent, h, onMounted, ref, watch, type PropType, type CSSProperties } from 'vue'
import { Icon as IconifyIcon, iconExists } from '@iconify/vue'
import {
  buildIconStyle,
  getA11yAttributes,
  isDev,
  parseName,
  warnMissingA11y,
} from '@genvoice/icons-core'
import { getAntIconSync, resolveAntIcon } from './antRegistry.js'
import type { AntIconComponent } from './types.js'

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
    spin: { type: Boolean, default: false },
    rotate: { type: Number, default: undefined },
  },
  setup(props) {
    const antComp = ref<AntIconComponent | null>(null)
    const antTried = ref(false)

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

    async function loadAnt() {
      const p = parsed.value
      if (!p || p.provider !== 'ant') {
        antComp.value = null
        antTried.value = true
        return
      }
      const sync = getAntIconSync(p.id)
      if (sync) {
        antComp.value = sync
        antTried.value = true
        return
      }
      antTried.value = false
      antComp.value = await resolveAntIcon(p.id)
      antTried.value = true
    }

    onMounted(() => {
      warnMissingA11y(props.name, {
        label: props.label,
        decorative: props.decorative,
      })
      void loadAnt()
    })

    watch(
      () => props.name,
      () => {
        void loadAnt()
      },
    )

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

      if (p.provider === 'ant') {
        if (!antTried.value) {
          return h('span', {
            class: props.class,
            style: mergedStyle.value,
            'data-icon-loading': props.name,
            'aria-hidden': true,
          })
        }
        if (!antComp.value) {
          if (isDev()) {
            console.warn(`[GenVoice Icons] Icon not found: "${props.name}"`)
          }
          return h('span', {
            class: props.class,
            style: mergedStyle.value,
            'data-icon-missing': props.name,
            'aria-hidden': true,
          })
        }
        return h(antComp.value, {
          class: props.class,
          style: mergedStyle.value,
          spin: props.spin,
          rotate: props.rotate,
          ...a11y.value,
        })
      }

      if (p.provider === 'custom' && !iconExists(p.id)) {
        if (isDev()) {
          console.warn(
            `[GenVoice Icons] Custom icon "${props.name}" is not registered. ` +
              'Call registerCustomIcons() from @genvoice/icons-custom/vue at app bootstrap.',
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
