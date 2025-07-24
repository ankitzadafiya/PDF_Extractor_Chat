import { Routes } from '@angular/router';

export const routes: Routes = [
    // Default route to the pdf extractor
    { path: '', redirectTo: 'pdf-extractor', pathMatch: 'full' },
    // Route to the pdf extractor
    { path: 'pdf-extractor', loadComponent: () => 
    import('./components/pdf-upload/pdf-upload').then(m => m.PdfUpload) },
    // For any other route, redirect to the pdf extractor
    { path: '**', redirectTo: 'pdf-extractor', pathMatch: 'full' }
];
