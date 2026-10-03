import type { Inputs } from '../state';
import type { Model } from '../model';
import type { SavedScenario } from '../storage';

/** Gera o relatório PDF e descarrega-o. A biblioteca só é carregada quando é usada. */
export async function exportPdf(inputs: Inputs, model: Model, scenarios: SavedScenario[]) {
  const [{ pdf }, { Report }] = await Promise.all([import('@react-pdf/renderer'), import('./Report')]);
  const now = new Date();
  const blob = await pdf(<Report inputs={inputs} model={model} scenarios={scenarios} generatedAt={now} />).toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `simulacao-casa-${now.toISOString().slice(0, 10)}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
