import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Chat {
  constructor(private http: HttpClient) {}

  sendMessage(question: string, filename: string): Observable<any> {
    const body = { question, filename };
    return this.http.post<any>('http://localhost:3000/chat', body);
  }
}
