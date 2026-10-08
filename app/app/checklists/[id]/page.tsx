import { getChecklistTemplateById } from "@/app/actions/checklists";
import ChecklistFillForm from "./ChecklistFillForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FillChecklistPage({ params }: { params: { id: string } }) {
  const template = await getChecklistTemplateById(params.id);

  if (!template) {
    notFound();
  }

  return <ChecklistFillForm template={template} />;
}
