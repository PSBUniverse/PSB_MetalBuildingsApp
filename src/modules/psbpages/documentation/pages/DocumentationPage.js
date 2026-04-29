import { loadBookManifest, loadSection } from "../data/documentation.actions";
import DocumentationView from "./DocumentationView";
//documentation page, loads the manifest and the initial section, then renders the view
export default async function DocumentationPage() {
  const manifest = await loadBookManifest();
  const initialSection = await loadSection("setup");

  return (
    <DocumentationView
      manifest={manifest}
      initialSection={initialSection}
    />
  );
}
