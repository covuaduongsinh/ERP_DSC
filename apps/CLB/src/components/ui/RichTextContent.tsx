import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Coach, Post } from '@/payload-types'

type RichTextData = Coach['bio'] | Post['content']

type RichTextContentProps = {
  data: RichTextData | null | undefined
  className?: string
  variant?: 'default' | 'article'
}

const variantClasses: Record<NonNullable<RichTextContentProps['variant']>, string> = {
  default: 'prose-sm',
  article: 'prose-base sm:prose-lg',
}

export function RichTextContent({
  data,
  className = '',
  variant = 'default',
}: RichTextContentProps) {
  if (!data) {
    return null
  }

  return (
    <RichText
      data={data}
      className={`prose ${variantClasses[variant]} max-w-none text-[var(--ds-text)] prose-headings:text-primary prose-a:text-primary prose-strong:text-primary ${className}`}
    />
  )
}
