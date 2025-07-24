import { Component } from '@angular/core';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ViewPdf } from './view-pdf/view-pdf';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Chat } from '../chat/chat';
import { HttpClient } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Upload } from '../../services/upload';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-pdf-upload',
  imports: [PdfViewerModule, MatButtonModule, MatInputModule, MatFormFieldModule, MatIconModule,
    CommonModule, MatCardModule, MatIconModule, ViewPdf, MatProgressBarModule, Chat, MatProgressSpinnerModule],
  templateUrl: './pdf-upload.html',
  styleUrl: './pdf-upload.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class PdfUpload {

  /**
   * pdfSrc is the source of the pdf file.
   * Used to display the pdf file in the pdf viewer.
   *
   * @type {*}
   * @memberof PdfUpload
   */
  pdfSrc: any = null;

  /**
   * pdfUploaded is a boolean that is used to check if the pdf file has been uploaded.
   *
   * @type {boolean}
   * @memberof PdfUpload
   */
  pdfUploaded = false;


  /**
   * showPdfViewer is a boolean that is used to check if the pdf viewer should be shown.
   *
   * @type {boolean}
   * @memberof PdfUpload
   */
  showPdfViewer = false;


  /**
   * isLoading is a boolean that is used to check if the pdf file is loading.
   *
   * @type {boolean}
   * @memberof PdfUpload
   */
  isLoading = false;

  /**
   * uploadedFilename is the name of the pdf file that has been uploaded.
   *
   * @type {(string | null)}
   * @memberof PdfUpload
   */
  uploadedFilename: string | null = null;

  /**
   * summary is the summary of the pdf file & sending to the chat.
   *
   * @type {string}
   * @memberof PdfUpload
   */
  summary: string = '';

  /**
   * suggestedQuestions is the array of suggested questions for the chat.
   *
   * @type {string[]}
   * @memberof PdfUpload
   */
  suggestedQuestions: string[] = [];

  /**
   * fileNameToDisplay is the name of the pdf file that is displayed in the pdf viewer.
   *
   * @type {string}
   * @memberof PdfUpload
   */
  fileNameToDisplay: string = '';

  constructor(private uploadService: Upload) { }

  /**
   * onFileSelected is a function that is called when a file is selected.
   * It uploads the pdf file to the server and displays the pdf file in the pdf viewer.
   *
   * @param {*} event
   * @memberof PdfUpload
   */
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    console.log(file);
    this.fileNameToDisplay = file?.name;
    if (file) {
      this.isLoading = true;
      this.uploadService.uploadPdf(file)
        .subscribe({
          next: (response) => {
            console.log('Upload response:', response);
            this.uploadedFilename = response.filename;

            // For local viewing, read file as data URL
            const reader = new FileReader();
            reader.onload = (e: any) => {
              this.pdfSrc = e.target.result;
              this.pdfUploaded = true;
              this.isLoading = false;
              // Set a sample summary and questions (replace with backend call if needed)
              this.summary = 'Ask me anything about the document. :)';
              this.suggestedQuestions = [
                'Summarize this document',
                'What are the key points?',
                'Who is the author?',
              ];
            };
            reader.readAsArrayBuffer(file);
          },
          error: (err) => {
            console.error('Upload failed:', err);
            this.isLoading = false;
          }
        });
    }
  }

  /**
   * This function is called when a file is dragged over the component.
   *
   * @param {DragEvent} event
   * @memberof PdfUpload
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * This function is called when a file is dropped on the component.
   *
   * @param {DragEvent} event
   * @memberof PdfUpload
   */
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.onFileSelected({ target: { files: event.dataTransfer.files } });
    }
  }
}
