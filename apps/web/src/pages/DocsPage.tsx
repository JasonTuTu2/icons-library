export function DocsPage() {
  return (
    <article className="docs">
      <h1>Documentation</h1>
      <p className="lede">
        GenVoice Icons unifies Ant Design Icons, Iconify, and GenVoice custom
        SVGs behind one API for React and Vue, with a searchable browser for
        designers and developers.
      </p>

      <section>
        <h2>Install</h2>
        <p>
          Packages are on GitHub Packages. Add this to your app{' '}
          <code>.npmrc</code> and set <code>NODE_AUTH_TOKEN</code> to a GitHub
          PAT with <code>read:packages</code>:
        </p>
        <pre>
          <code>{`@JasonTuTu2:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}`}</code>
        </pre>
        <pre>
          <code>{`# React
pnpm add @JasonTuTu2/icons-react @ant-design/icons @iconify/react

# Vue
pnpm add @JasonTuTu2/icons-vue @ant-design/icons-vue @iconify/vue

# Custom GenVoice brand icons
pnpm add @JasonTuTu2/icons-custom

# Optional offline Iconify sets
pnpm add @iconify-json/mdi @iconify-json/lucide @iconify-json/heroicons`}</code>
        </pre>
      </section>

      <section>
        <h2>Usage</h2>
        <h3>React</h3>
        <pre>
          <code>{`import { registerCustomIcons } from '@JasonTuTu2/icons-custom/react'
import { Icon } from '@JasonTuTu2/icons-react'

registerCustomIcons()

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
<Icon name="gv:billing-alert" size={24} label="Billing" />`}</code>
        </pre>
        <h3>Vue</h3>
        <pre>
          <code>{`<script setup>
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/vue'
import { Icon } from '@JasonTuTu2/icons-vue'

registerCustomIcons()
</script>

<template>
  <Icon name="ant:HomeOutlined" :size="24" label="Home" />
  <Icon name="mdi:home" size="1.5em" decorative />
  <Icon name="gv:star" :size="24" label="Favorite" />
</template>`}</code>
        </pre>
      </section>

      <section>
        <h2>Custom icons from Figma</h2>
        <ol>
          <li>Export SVG from Figma (prefer 24×24, simple paths).</li>
          <li>
            Commit to <code>packages/custom-icons/svg/</code> (monochrome) or{' '}
            <code>svg/color/</code> (multi-color), or use <strong>Upload SVG</strong>{' '}
            in the browser while running <code>pnpm dev</code> and pick a color mode.
          </li>
          <li>
            Run <code>pnpm catalog:gen</code> if you added files via git (upload
            regenerates and rebuilds packages automatically).
          </li>
          <li>
            Use <code>gv:kebab-name</code> in designs and code. Call{' '}
            <code>registerCustomIcons()</code> once at app bootstrap.
          </li>
        </ol>
        <p>
          Monochrome icons are normalized to <code>currentColor</code> so{' '}
          <code>color</code> / CSS inheritance works. Multi-color icons preserve
          their fills; the <code>color</code> prop may not recolor them. Filter by
          color mode in the browser to separate the two.
        </p>
      </section>

      <section>
        <h2>Props</h2>
        <ul>
          <li>
            <code>name</code> — canonical id (<code>ant:HomeOutlined</code>,{' '}
            <code>gv:star</code>, or Iconify <code>prefix:name</code>)
          </li>
          <li>
            <code>size</code> — number (px) or CSS length (default{' '}
            <code>1em</code>)
          </li>
          <li>
            <code>color</code> — CSS color (default <code>currentColor</code>)
          </li>
          <li>
            <code>label</code> — accessible name for meaningful icons
          </li>
          <li>
            <code>decorative</code> — marks presentational icons{' '}
            <code>aria-hidden</code>
          </li>
          <li>
            <code>className</code> / <code>class</code>, <code>style</code>,{' '}
            <code>spin</code>, <code>rotate</code>
          </li>
        </ul>
      </section>

      <section>
        <h2>Accessibility</h2>
        <p>
          Pass <code>label</code> for meaningful icons or{' '}
          <code>decorative</code> for presentational ones. Prefer wrapping
          interactive icons in a <code>button</code> or link rather than putting
          click handlers on the icon alone.
        </p>
      </section>

      <section>
        <h2>Offline Iconify</h2>
        <p>
          For production apps, register icon data so icons do not depend on the
          Iconify API:
        </p>
        <pre>
          <code>{`import { addCollection } from '@iconify/react'
import mdi from '@iconify-json/mdi/icons.json'

addCollection(mdi)`}</code>
        </pre>
      </section>

      <section>
        <h2>Licensing</h2>
        <p>
          GenVoice packages are MIT. Icon artwork remains under upstream
          licenses (Ant Design Icons MIT; Iconify collections vary). Custom{' '}
          <code>gv:</code> icons are GenVoice proprietary / internal unless
          noted otherwise. Check each icon&apos;s detail panel before shipping.
        </p>
      </section>

      <section>
        <h2>Compatibility</h2>
        <ul>
          <li>React 18+ / Vue 3</li>
          <li>
            Peers: <code>@ant-design/icons</code> ^5–6,{' '}
            <code>@ant-design/icons-vue</code> ^7,{' '}
            <code>@iconify/react</code> / <code>@iconify/vue</code>
          </li>
        </ul>
      </section>
    </article>
  )
}
