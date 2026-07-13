export function DocsPage() {
  return (
    <article className="docs">
      <h1>Documentation</h1>
      <p className="lede">
        GenVoice Icons unifies Ant Design Icons and Iconify behind one API for
        React and Vue, with a searchable browser for designers and developers.
      </p>

      <section>
        <h2>Install</h2>
        <pre>
          <code>{`# React
pnpm add @genvoice/icons-react @ant-design/icons @iconify/react

# Vue
pnpm add @genvoice/icons-vue @ant-design/icons-vue @iconify/vue

# Optional offline Iconify sets
pnpm add @iconify-json/mdi @iconify-json/lucide @iconify-json/heroicons`}</code>
        </pre>
      </section>

      <section>
        <h2>Usage</h2>
        <h3>React</h3>
        <pre>
          <code>{`import { Icon } from '@genvoice/icons-react'

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />`}</code>
        </pre>
        <h3>Vue</h3>
        <pre>
          <code>{`<script setup>
import { Icon } from '@genvoice/icons-vue'
</script>

<template>
  <Icon name="ant:HomeOutlined" :size="24" label="Home" />
  <Icon name="mdi:home" size="1.5em" decorative />
</template>`}</code>
        </pre>
      </section>

      <section>
        <h2>Props</h2>
        <ul>
          <li>
            <code>name</code> — canonical id (<code>ant:HomeOutlined</code> or
            Iconify <code>prefix:name</code>)
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
          licenses (Ant Design Icons MIT; Iconify collections vary). Check each
          icon&apos;s detail panel in the browser before shipping.
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
