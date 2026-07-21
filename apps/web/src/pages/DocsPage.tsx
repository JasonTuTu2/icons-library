interface DocsPageProps {
  /** Install / props / a11y for maintainers; designers still see ops + Figma flow. */
  showDevSections?: boolean
}

export function DocsPage({ showDevSections = true }: DocsPageProps) {
  return (
    <article className="docs">
      <h1>Documentation</h1>
      <p className="lede">
        GenVoice Icons is the brand icon library for React and Vue — custom{' '}
        <code>ci:</code> SVGs and <code>img:</code> brand images, with a
        searchable browser for designers and developers.
      </p>

      <section id="designer-ops">
        <h2>Designer ops</h2>
        <p>
          Everyday path from Figma to the published package (same login in the
          plugin and on the site):
        </p>
        <ol>
          <li>
            <strong>Sign in</strong> in the Figma plugin and in the icon browser
            (same account).
          </li>
          <li>
            <strong>Load</strong> selection → set format / names / properties →{' '}
            <strong>Stage</strong>. Staging syncs to your account (no plugin link
            required).
          </li>
          <li>
            Open the site → <strong>Upload</strong>. Your queue appears under
            staged. Review, then <strong>Apply</strong>. Wait ~1–2 minutes for
            the Actions workflow, then hard-refresh.
          </li>
          <li>
            Under Upload → <strong>unpublished</strong>, check what should ship.
            Unchecked icons stay in the library for a later release.
          </li>
          <li>
            A <strong>dev</strong> runs <strong>Publish</strong> → wait for the
            publish Action → packages update on GitHub Packages.
          </li>
        </ol>
        <p>
          Optional: <strong>Open icon browser</strong> in the plugin still works
          as a shortcut with auth handoff. Prefer bookmarking the site when
          already signed in.
        </p>
      </section>

      {showDevSections ? (
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
pnpm add @JasonTuTu2/icons-react @iconify/react

# Vue
pnpm add @JasonTuTu2/icons-vue @iconify/vue`}</code>
          </pre>
          <p>
            <code>@iconify/react</code> / <code>@iconify/vue</code> are peers used
            to render registered brand SVGs — they are not a third-party icon set
            in this library.
          </p>
        </section>
      ) : null}

      {showDevSections ? (
        <section>
          <h2>Usage</h2>
          <h3>React</h3>
          <pre>
            <code>{`import { Icon } from '@JasonTuTu2/icons-react'

<Icon name="ci:billing-alert" size={24} label="Billing" />
<Icon name="ci:cart" size="1.5em" decorative />`}</code>
          </pre>
          <h3>Vue</h3>
          <pre>
            <code>{`<script setup>
import { Icon } from '@JasonTuTu2/icons-vue'
</script>

<template>
  <Icon name="ci:billing-alert" :size="24" label="Billing" />
  <Icon name="ci:cart" size="1.5em" decorative />
</template>`}</code>
          </pre>
        </section>
      ) : null}

      <section>
        <h2>Custom icons from Figma</h2>
        <ol>
          <li>
            Prefer the Figma Development plugin (Load selection → Stage). Vectors
            become <code>ci:</code> SVGs; placed PNG/JPG rasters become{' '}
            <code>img:</code> brand images. Use the format dropdown (SVG / PNG /
            JPG) to override auto-detect. You can also upload files in the full
            icon browser.
          </li>
          <li>
            Then run <strong>Apply</strong> in Upload, wait ~1–2 minutes on
            Actions, hard-refresh, check unpublished icons, and have a dev{' '}
            <strong>Publish</strong>. Or commit to{' '}
            <code>packages/custom-icons/svg/</code> (mono) /{' '}
            <code>svg/color/</code> (multi-color) / <code>images/</code>{' '}
            (PNG/JPG) and run <code>pnpm catalog:gen</code>.
          </li>
          <li>
            Use <code>ci:kebab-name</code> with <code>Icon</code> for SVGs.
            Brand images use <code>img:kebab-name</code> and file imports from{' '}
            <code>@JasonTuTu2/icons-custom/images/…</code>.
          </li>
        </ol>
        <p>
          Monochrome icons are normalized to <code>currentColor</code> so{' '}
          <code>color</code> / CSS inheritance works. Multi-color and gradient
          icons preserve their fills / paint servers; the <code>color</code>{' '}
          prop may not recolor them.
        </p>
        <p>
          Assign a <strong>Category</strong> before Stage (apply to all or per
          asset). Default is <em>No Category</em>. Edit category later in the
          detail sidebar for custom <code>ci:</code> / <code>img:</code> assets.
        </p>
        <p>
          Each custom asset also has a <strong>Variant</strong>,{' '}
          <strong>Source</strong>, <strong>Usage</strong>, and optional{' '}
          <strong>Note</strong> — set in Upload, the plugin, or the detail
          sidebar.
        </p>
      </section>

      <section>
        <h2>Removing a custom icon</h2>
        <ol>
          <li>
            Select a <code>ci:</code> or <code>img:</code> asset →{' '}
            <strong>Stage removal</strong>.
          </li>
          <li>
            <strong>Apply</strong> — deletes the asset and regenerates the
            catalog.
          </li>
          <li>
            Then <strong>Publish</strong> so consumer packages no longer include
            it.
          </li>
        </ol>
      </section>

      <section>
        <h2>First publish (happy path)</h2>
        <ol>
          <li>Stage in Figma or Upload (signed in).</li>
          <li>Apply → wait for Actions → hard-refresh.</li>
          <li>
            Under Upload → unpublished, check icons to ship (unchecked stay out
            of this package).
          </li>
          <li>Publish (dev) → wait for the publish Action → confirm Packages.</li>
        </ol>
      </section>

      {showDevSections ? (
        <>
          <section>
            <h2>Props</h2>
            <ul>
              <li>
                <code>name</code> — required canonical id (
                <code>ci:billing-alert</code>)
              </li>
              <li>
                <code>size</code> — number (px) or CSS length (default{' '}
                <code>1em</code>)
              </li>
              <li>
                <code>color</code> — CSS color (default <code>currentColor</code>
                ). Works for monochrome <code>ci:</code> icons; multi-color{' '}
                <code>ci:</code> icons keep baked fills
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
            </ul>
          </section>

          <section>
            <h2>Accessibility</h2>
            <p>
              Pass <code>label</code> for meaningful icons or{' '}
              <code>decorative</code> for presentational ones. Prefer wrapping
              interactive icons in a <code>button</code> or link rather than
              putting click handlers on the icon alone.
            </p>
          </section>

          <section>
            <h2>Licensing</h2>
            <p>
              Published packages are MIT. Brand <code>ci:</code> /{' '}
              <code>img:</code> assets are proprietary / internal unless noted
              otherwise. Check each icon&apos;s detail panel before shipping.
            </p>
          </section>

          <section>
            <h2>Compatibility</h2>
            <ul>
              <li>React 18+ / Vue 3</li>
              <li>
                Peers: <code>@iconify/react</code> / <code>@iconify/vue</code>{' '}
                (render backend for brand SVGs)
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </article>
  )
}
