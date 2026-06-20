/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

// ⚠️ THÊM TAY (không do Payload generate): Server Action import CSV (processImport
// — app/actions/runImport.ts) chạy trong route /admin này, ghi hàng trăm bản ghi
// tuần tự → cần nới giới hạn thời gian thực thi của serverless để không bị kill
// giữa chừng ("unexpected response"). NẾU file này bị `payload generate:importmap`
// ghi đè, PHẢI thêm lại dòng dưới.
export const maxDuration = 60

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = ({ params, searchParams }: Args) =>
  RootPage({ config, params, searchParams, importMap })

export default Page
