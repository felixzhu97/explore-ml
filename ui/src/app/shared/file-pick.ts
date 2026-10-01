import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { NzUploadModule } from 'ng-zorro-antd/upload';

/** Picks one local file without uploading it; the page sends it with its own request. */
@Component({
  selector: 'app-file-pick',
  imports: [NzButtonModule, NzIconModule, NzUploadModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-upload
      [nzAccept]="accept()"
      [nzFileList]="files()"
      [nzBeforeUpload]="select"
      (nzFileListChange)="onListChange($event)"
    >
      <button nz-button nzShape="round"><nz-icon nzType="upload" />{{ label() }}</button>
    </nz-upload>
  `,
})
export class FilePick {
  readonly accept = input('');
  readonly label = input('选择文件');
  readonly picked = output<File | null>();
  protected readonly files = signal<NzUploadFile[]>([]);

  protected readonly select = (file: NzUploadFile): boolean => {
    this.files.set([file]);
    this.picked.emit(file as unknown as File);
    return false;
  };

  protected onListChange(list: NzUploadFile[]): void {
    if (list.length) return;
    this.files.set([]);
    this.picked.emit(null);
  }
}
