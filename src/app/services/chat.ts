import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Chat {
  constructor(private http: HttpClient) {}

  sendMessage(question: string, filename: string): Observable<any> {
    const body = { question, filename };
    return this.http.post<any>(`${environment.apiBaseUrl}/chat`, body);
  }
}
