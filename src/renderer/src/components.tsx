import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
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
                if (href?.startsWith('https:')) void window.desktop?.openExternal(href)
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
export function Icon({
  name,
}: {
  name: 'cards' | 'study' | 'stats' | 'settings' | 'arrow' | 'plus' | 'spark' | 'moon' | 'sun'
}) {
  const paths = {
    moon: 'M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z',
    sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
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
