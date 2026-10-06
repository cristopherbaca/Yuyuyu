import { useEffect, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { message } from './api'
const sanitize = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^language-./, 'math-inline', 'math-display'],
    ],
  },
}
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeSanitize, sanitize],
          [rehypeKatex, { trust: false, strict: 'warn' }],
        ]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href?.startsWith('https:') ? href : undefined}
              onClick={(event) => {
                event.preventDefault()
                if (href?.startsWith('https:')) void window.api.openExternal(href)
              }}
            >
              {children}
            </a>
          ),
          img: ({ alt }) => <span>{alt ? `[${alt}]` : ''}</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="notice error">
      {error}
    </div>
  ) : null
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="notice">
      {children}
    </div>
  )
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}
export function useResource<T>(load: () => Promise<T>, dependencies: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    load()
      .then((value) => {
        if (alive) setData(value)
      })
      .catch((error) => {
        if (alive) setError(message(error))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [...dependencies, revision]) // Callers provide the resource identity as dependencies.
  return { data, error, loading, reload: () => setRevision((value) => value + 1) }
}
export function Icon({
  name,
}: {
  name: 'cards' | 'study' | 'stats' | 'settings' | 'arrow' | 'plus' | 'spark'
}) {
  const paths = {
    cards:
      'M7 3h10a2 2 0 0 1 2 2v12M5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
    study: 'm9 5 10 7-10 7V5Z',
    stats: 'M4 20V10m8 10V4m8 16v-7M2 20h20',
    settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    plus: 'M12 5v14M5 12h14',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
