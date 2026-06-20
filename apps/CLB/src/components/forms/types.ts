/** Dữ liệu form tư vấn — khớp field collection Leads (trừ source/status do server gán). */
export type ConsultationFormData = {
  fullName: string
  phone: string
  childAge?: string
  interestedLocation?: string
  note?: string
}

export type ConsultationLocationOption = {
  id: number
  name: string
}
