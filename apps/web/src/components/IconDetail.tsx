import { useState } from 'react'
import type { IconMeta } from '@genvoice/icons-catalog'
import { Icon } from '@genvoice/icons-react'

interface IconDetailProps {
  icon: IconMeta
  reactCode: string
  vueCode: string
  onClose: () => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function IconDetail({
  icon,
  reactCode,
  vueCode,
  onClose,
}: IconDetailProps) {
  const [copied, setCopied] = useState<string | null>(null)

  async function handleCopy(label: string, text: string) {
    const ok = await copyText(text)
    setCopied(ok ? label : 'failed')
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <aside className="detail">
      <div className="detail-header">
        <h2>{icon.title}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="detail-preview">
        <Icon name={icon.id} size={56} label={icon.title} />
      </div>

      <dl className="meta">
        <div>
          <dt>Canonical name</dt>
          <dd>
            <code>{icon.id}</code>
            <button
              type="button"
              className="ghost"
              onClick={() => handleCopy('name', icon.id)}
            >
              Copy
            </button>
          </dd>
        </div>
        <div>
          <dt>Set / source</dt>
          <dd>
            {icon.set} · {icon.source}
          </dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>
            {icon.license.title}
            {icon.license.spdx ? ` (${icon.license.spdx})` : ''}
            {icon.license.url ? (
              <>
                {' '}
                <a href={icon.license.url} target="_blank" rel="noreferrer">
                  Upstream
                </a>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <section className="snippet">
        <div className="snippet-head">
          <h3>React</h3>
          <button
            type="button"
            className="ghost"
            onClick={() => handleCopy('react', reactCode)}
          >
            Copy
          </button>
        </div>
        <pre>
          <code>{reactCode}</code>
        </pre>
      </section>

      <section className="snippet">
        <div className="snippet-head">
          <h3>Vue</h3>
          <button
            type="button"
            className="ghost"
            onClick={() => handleCopy('vue', vueCode)}
          >
            Copy
          </button>
        </div>
        <pre>
          <code>{vueCode}</code>
        </pre>
      </section>

      {copied ? (
        <p className="copy-toast" role="status">
          {copied === 'failed' ? 'Copy failed' : `Copied ${copied}`}
        </p>
      ) : null}
    </aside>
  )
}
