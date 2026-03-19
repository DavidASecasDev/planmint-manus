import { AppLayout } from "@/components/layout/AppLayout";
import { FormEditor } from "@/components/forms/FormEditor";

export default function FormEditorPage() {
  return (
    <AppLayout title="Editor de formulario">
      <FormEditor />
    </AppLayout>
  );
}
