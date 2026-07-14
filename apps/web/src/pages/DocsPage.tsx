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

# Optional offline Iconify sets
pnpm add @iconify-json/mdi @iconify-json/lucide @iconify-json/heroicons`}</code>
        </pre>
      </section>

      <section>
        <h2>Usage</h2>
        <h3>React</h3>
        <pre>
          <code>{`import { Icon } from '@JasonTuTu2/icons-react'

<Icon name="ant:HomeOutlined" size={24} label="Home" />
<Icon name="mdi:home" size="1.5em" decorative />
<Icon name="gv:billing-alert" size={24} label="Billing" />`}</code>
        </pre>
        <h3>Vue</h3>
        <pre>
          <code>{`<script setup>
import { Icon } from '@JasonTuTu2/icons-vue'
</script>

<template>
  <Icon name="ant:HomeOutlined" :size="24" label="Home" />
  <Icon name="mdi:home" size="1.5em" decorative />
  <Icon name="gv:cart" :size="24" label="Cart" />
</template>`}</code>
        </pre>
      </section>

      <section>
        <h2>Custom icons from Figma</h2>
        <ol>
          <li>Export SVG from Figma (prefer 24×24, simple paths).</li>
          <li>
            Prefer <strong>Add to staging</strong> in this browser (monochrome or
            multi-color), then <strong>Apply staged to library</strong> and{' '}
            <strong>Publish</strong>. Or commit to{' '}
            <code>packages/custom-icons/svg/</code> (mono) /{' '}
            <code>svg/color/</code> (multi-color) and run{' '}
            <code>pnpm catalog:gen</code>. Local <code>pnpm dev</code> upload
            writes to disk without GitHub staging.
          </li>
          <li>
            Use <code>gv:kebab-name</code> in designs and code. Custom icons
            register automatically when you import <code>Icon</code> — no
            bootstrap call.
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
            <code>name</code> — required canonical id (<code>ant:HomeOutlined</code>
            , <code>gv:billing-alert</code>, or Iconify <code>prefix:name</code>)
          </li>
          <li>
            <code>size</code> — number (px) or CSS length (default{' '}
            <code>1em</code>)
          </li>
          <li>
            <code>color</code> — CSS color (default <code>currentColor</code>).
            Works for monochrome <code>gv:</code> icons; multi-color <code>gv:</code>{' '}
            icons keep baked fills
          </li>
          <li>
            <code>label</code> — accessible name for meaningful icons
          </li>
          <li>
            <code>decorative</code> — presentational; sets{' '}
            <code>aria-hidden</code>
          </li>
          <li>
            <code>className</code> / <code>class</code>, <code>style</code>
          </li>
          <li>
            <code>rotate</code> — degrees (CSS transform)
          </li>
          <li>
            <code>spin</code> — Ant icons only; ignored for Iconify and{' '}
            <code>gv:</code>
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
