import { Component, Input } from '@angular/core';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-view-pdf',
  imports: [PdfViewerModule, CommonModule],
  templateUrl: './view-pdf.html',
  styleUrl: './view-pdf.scss'
})
export class ViewPdf {

  /**
   * pdfSrc is the source of the pdf file.
   * Used to display the pdf file in the pdf viewer.
   *
   * @type {string}
   * @memberof ViewPdf
   */
  @Input() pdfSrc: string = '';

  constructor() {}

}
