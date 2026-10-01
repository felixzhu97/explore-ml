import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ConfusionMatrix } from '../../charts/confusion-matrix';
import { GroupedBarChart } from '../../charts/grouped-bar-chart';
import {
  REPORT_TITLES,
  deltas,
  detectReport,
  toGrouped,
  type DeltaRow,
  type GroupedData,
  type LoadedReport,
  type Report,
  type ReportKind,
} from '../../core/eval-report';

const SAMPLES = [
  'recommendation.json',
  'vision.json',
  'retrieval-base.json',
  'retrieval-ft.json',
  'llm.json',
  'speech.json',
];

interface Panel {
  kind: ReportKind;
  title: string;
  names: string[];
  grouped: GroupedData | null;
  deltas: DeltaRow[];
  lowerIsBetter: boolean;
  max?: number;
  vision?: Extract<Report, { kind: 'vision' }>;
  judge?: string;
}

/** `ft` is the first series for model/baseline reports; for retrieval the first file is the base. */
function buildPanel(kind: ReportKind, items: LoadedReport[]): Panel {
  const grouped = toGrouped(items);
  const lowerIsBetter = kind === 'speech';
  const baseIndex = kind === 'retrieval' ? 0 : (grouped?.series.length ?? 1) - 1;
  const first = items[0].report;
  return {
    kind,
    title: REPORT_TITLES[kind],
    names: items.map((i) => i.name),
    grouped,
    deltas: grouped ? deltas(grouped, lowerIsBetter, baseIndex) : [],
    lowerIsBetter,
    max: kind === 'llm' || kind === 'speech' ? undefined : 1,
    vision: first.kind === 'vision' ? first : undefined,
    judge: first.kind === 'llm' ? first.judge : undefined,
  };
}

@Component({
  selector: 'app-evaluation',
  imports: [GroupedBarChart, ConfusionMatrix, DecimalPipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluation.html',
  styleUrl: './evaluation.css',
})
export class Evaluation {
  protected readonly reports = signal<LoadedReport[]>([]);
  protected readonly rejected = signal<string[]>([]);
  protected readonly dragOver = signal(false);

  /** Retrieval reports share one comparison panel; other kinds get one panel per file. */
  protected readonly panels = computed<Panel[]>(() => {
    const all = this.reports();
    const retrieval = all.filter((r) => r.report.kind === 'retrieval');
    const panels = all
      .filter((r) => r.report.kind !== 'retrieval')
      .map((r) => buildPanel(r.report.kind, [r]));
    if (retrieval.length) panels.push(buildPanel('retrieval', retrieval));
    return panels;
  });

  protected onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    void this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    void this.addFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  protected async loadSamples(): Promise<void> {
    const files = await Promise.all(
      SAMPLES.map(async (name) => ({ name, text: await (await fetch(`samples/${name}`)).text() })),
    );
    this.reports.set([]);
    this.rejected.set([]);
    files.forEach((f) => this.add(f.name, f.text));
  }

  protected clear(): void {
    this.reports.set([]);
    this.rejected.set([]);
  }

  private async addFiles(files: File[]): Promise<void> {
    for (const file of files) this.add(file.name, await file.text());
  }

  private add(name: string, text: string): void {
    let report: Report | null = null;
    try {
      report = detectReport(JSON.parse(text));
    } catch {
      report = null;
    }
    if (report) {
      const r = report;
      this.reports.update((list) => [...list.filter((x) => x.name !== name), { name, report: r }]);
    } else {
      this.rejected.update((list) => [...list, name]);
    }
  }
}
