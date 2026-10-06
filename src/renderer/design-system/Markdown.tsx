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
